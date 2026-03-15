import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/src/firebaseConfig";
import { updateUserProfile } from "@/src/features/users";

export function useAvatarUpload(userId?: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickAndUpload = useCallback(async () => {
    if (!userId) return;

    Alert.alert("Update Photo", "Choose a source", [
      {
        text: "Take Photo",
        onPress: () => launchCamera(userId),
      },
      {
        text: "Choose from Library",
        onPress: () => launchLibrary(userId),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [userId]);

  const launchCamera = useCallback(
    async (uid: string) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Camera access is required to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        await upload(uid, result.assets[0].uri);
      }
    },
    []
  );

  const launchLibrary = useCallback(
    async (uid: string) => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        await upload(uid, result.assets[0].uri);
      }
    },
    []
  );

  const upload = useCallback(
    async (uid: string, localUri: string) => {
      setUploading(true);
      setProgress(0);

      try {
        const response = await fetch(localUri);
        const blob = await response.blob();

        const storageRef = ref(storage, `avatars/${uid}.jpg`);
        const task = uploadBytesResumable(storageRef, blob);

        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snapshot) => {
              setProgress(snapshot.bytesTransferred / snapshot.totalBytes);
            },
            (error) => reject(error),
            () => resolve()
          );
        });

        const downloadUrl = await getDownloadURL(storageRef);
        await updateUserProfile(uid, { avatarUrl: downloadUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        Alert.alert("Upload Error", message);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    []
  );

  return { pickAndUpload, uploading, progress };
}
