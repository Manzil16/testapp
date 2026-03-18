import "react-native-get-random-values";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { v4 as uuidv4 } from "uuid";

const CHARGER_BUCKET = "charger-images";
const MAX_WIDTH = 1200;
const QUALITY = 0.8;

/**
 * Ensures a value is a full public URL. If it's a storage key/path,
 * constructs the public URL from Supabase storage.
 */
export function ensurePublicUrl(urlOrPath: string, bucket = CHARGER_BUCKET): string {
  if (!urlOrPath) return "";
  // Already a full URL
  if (urlOrPath.startsWith("https://") || urlOrPath.startsWith("http://")) {
    return urlOrPath;
  }
  // It's a relative storage key — construct the full URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(urlOrPath);
  return data.publicUrl;
}

// ── Permission Helpers ──

async function requestMediaPermission(): Promise<boolean> {
  if (Platform.OS === "web") return true;

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Camera roll access is needed to select photos. Please enable it in Settings.",
      [{ text: "OK" }]
    );
    return false;
  }
  return true;
}

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Camera access is needed to take photos. Please enable it in Settings.",
      [{ text: "OK" }]
    );
    return false;
  }
  return true;
}

// ── Image Manipulation ──

export async function compressImage(
  uri: string,
  maxWidth = MAX_WIDTH,
  quality = QUALITY
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// ── Picker Helpers ──

export async function pickImage(
  options?: Partial<ImagePicker.ImagePickerOptions>
): Promise<ImagePicker.ImagePickerAsset | null> {
  const hasPermission = await requestMediaPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 9],
    quality: QUALITY,
    ...options,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function captureImage(
  options?: Partial<ImagePicker.ImagePickerOptions>
): Promise<ImagePicker.ImagePickerAsset | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 9],
    quality: QUALITY,
    ...options,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

// ── Upload Helpers ──

/**
 * Standard React Native upload using FormData.
 * This is the most reliable approach — RN's FormData natively
 * reads from file:// URIs and streams the actual bytes.
 */
async function uploadToStorage(
  bucket: string,
  filePath: string,
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Compress
  onProgress?.(0.1);
  const compressedUri = await compressImage(uri);

  // Build FormData with the local file URI — RN handles file:// natively
  onProgress?.(0.3);
  const ext = filePath.split(".").pop() || "jpg";
  const formData = new FormData();
  formData.append("", {
    uri: compressedUri,
    name: filePath.split("/").pop() || `image.${ext}`,
    type: "image/jpeg",
  } as any);

  // Upload via Supabase REST API directly (FormData works reliably)
  onProgress?.(0.5);
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || anonKey}`,
        apikey: anonKey,
        "x-upsert": "true",
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errBody}`);
  }

  onProgress?.(0.9);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  onProgress?.(1);
  return data.publicUrl;
}

// ── Public API ──

export async function pickAndUploadChargerImage(
  chargerId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const asset = await pickImage({ aspect: [16, 9] });
  if (!asset) throw new Error("Image selection cancelled");

  const fileName = `${chargerId}/${uuidv4()}.jpg`;
  return uploadToStorage(CHARGER_BUCKET, fileName, asset.uri, onProgress);
}

export async function captureAndUploadChargerImage(
  chargerId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const asset = await captureImage({ aspect: [16, 9] });
  if (!asset) throw new Error("Camera capture cancelled");

  const fileName = `${chargerId}/${uuidv4()}.jpg`;
  return uploadToStorage(CHARGER_BUCKET, fileName, asset.uri, onProgress);
}

export async function uploadAvatarImage(
  userId: string,
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(0.1);

  // Compress to square
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  onProgress?.(0.3);
  const fileName = `avatars/${userId}/${uuidv4()}.jpg`;

  // Build FormData
  const formData = new FormData();
  formData.append("", {
    uri: compressed.uri,
    name: `${uuidv4()}.jpg`,
    type: "image/jpeg",
  } as any);

  // Upload via REST
  onProgress?.(0.5);
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${CHARGER_BUCKET}/${fileName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || anonKey}`,
        apikey: anonKey,
        "x-upsert": "true",
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Avatar upload failed (${response.status}): ${errBody}`);
  }

  onProgress?.(0.9);
  const { data } = supabase.storage.from(CHARGER_BUCKET).getPublicUrl(fileName);
  onProgress?.(1);
  return data.publicUrl;
}

export async function deleteChargerImage(imageUrl: string): Promise<void> {
  const pathMatch = imageUrl.match(/charger-images\/(.+)/);
  if (!pathMatch) return;

  const { error } = await supabase.storage.from(CHARGER_BUCKET).remove([pathMatch[1]]);
  if (error) throw error;
}
