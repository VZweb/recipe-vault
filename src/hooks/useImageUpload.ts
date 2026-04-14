import { useState } from "react";
import { uploadRecipeImage } from "@/lib/storage";

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (recipeId: string, file: File): Promise<string> => {
    setUploading(true);
    setProgress(0);
    try {
      setProgress(50);
      const url = await uploadRecipeImage(recipeId, file);
      setProgress(100);
      return url;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}
