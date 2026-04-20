import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadRecipeImage } from "@/lib/storage";

export function useImageUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    setUploading(true);
    setProgress(0);
    try {
      setProgress(50);
      const url = await uploadRecipeImage(user.uid, file);
      setProgress(100);
      return url;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}
