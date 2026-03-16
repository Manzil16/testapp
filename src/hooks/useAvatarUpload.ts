import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadAvatarImage } from "../services/imageService";
import { useAuth } from "../features/auth/auth-context";

function humanizeUploadError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes("too large") || lower.includes("payload") || lower.includes("413") || lower.includes("size")) {
    return "Image too large. Choose a photo under 5MB.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || lower.includes("econnrefused")) {
    return "Upload failed \u2014 check your connection and try again.";
  }
  if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("403") || lower.includes("policy") || lower.includes("rls")) {
    return "Unable to save photo. Please sign out and back in.";
  }
  return "Something went wrong. Please try again.";
}

export function useAvatarUpload(userId?: string) {
  const { updateProfileDetails } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickAndUpload = useCallback(async () => {
    if (!userId) return;

    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Camera roll access is needed to upload a photo.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploading(true);
      setProgress(0.3);
      const publicUrl = await uploadAvatarImage(userId, result.assets[0].uri);
      setProgress(0.8);
      await updateProfileDetails({ avatarUrl: publicUrl });
      setProgress(1);
    } catch (error) {
      const msg = humanizeUploadError(error);
      Alert.alert("Upload Error", msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [userId, updateProfileDetails]);

  return { pickAndUpload, uploading, progress };
}
