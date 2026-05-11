import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

export async function uploadRecipeImage(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, `recipes/${uid}/files/${filename}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/** Shared library images; path must match `storage.rules` (recipeLibraryAdmin may write; any signed-in user may read). */
export async function uploadLibraryRecipeImage(
  recipeId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(
    storage,
    `recipes/library/${recipeId}/files/${filename}`
  );
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteRecipeImage(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // Image may have already been deleted
  }
}

export async function uploadPantryImage(
  uid: string,
  itemId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, `pantry/${uid}/${itemId}/${filename}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deletePantryImage(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // Image may have already been deleted
  }
}
