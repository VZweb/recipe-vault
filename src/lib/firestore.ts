import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  increment,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteRecipeImage } from "./storage";
import type { Recipe, RecipeFormData } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { PantryItem } from "@/types/pantry";

const recipesCol = collection(db, "recipes");
const tagsCol = collection(db, "tags");
const pantryCol = collection(db, "pantry");

function toDate(ts: Timestamp | Date | undefined): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date();
}

function docToRecipe(id: string, data: DocumentData): Recipe {
  return {
    id,
    title: data.title ?? "",
    description: data.description ?? "",
    servings: data.servings ?? null,
    prepTimeMin: data.prepTimeMin ?? null,
    cookTimeMin: data.cookTimeMin ?? null,
    sourceUrl: data.sourceUrl ?? "",
    videoUrl: data.videoUrl ?? "",
    imageUrls: data.imageUrls ?? [],
    tags: data.tags ?? [],
    ingredients: (data.ingredients ?? []).map((ing: Record<string, unknown>) => ({
      ...ing,
      nameSecondary: ing.nameSecondary ?? "",
    })),
    steps: data.steps ?? [],
    cookedCount: data.cookedCount ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function docToTag(id: string, data: DocumentData): Tag {
  return {
    id,
    name: data.name ?? "",
    color: data.color ?? "#78716c",
  };
}

function docToPantryItem(id: string, data: DocumentData): PantryItem {
  return {
    id,
    name: data.name ?? "",
    nameSecondary: data.nameSecondary ?? null,
    normalizedName: data.normalizedName ?? "",
    category: data.category ?? "Other",
    quantity: data.quantity ?? null,
    unit: data.unit ?? null,
    isStaple: data.isStaple ?? false,
    imageUrl: data.imageUrl ?? null,
    addedAt: toDate(data.addedAt),
  };
}

// --- Recipes ---

export async function fetchRecipes(tagIds?: string[]): Promise<Recipe[]> {
  let q;

  if (tagIds && tagIds.length > 0 && tagIds.length <= 10) {
    q = query(recipesCol, where("tags", "array-contains-any", tagIds));
  } else {
    q = query(recipesCol, orderBy("createdAt", "desc"));
  }

  const snap = await getDocs(q);
  const recipes = snap.docs.map((d) => docToRecipe(d.id, d.data()));

  if (tagIds && tagIds.length > 0) {
    recipes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return recipes;
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "recipes", id));
  if (!snap.exists()) return null;
  return docToRecipe(snap.id, snap.data());
}

export async function createRecipe(data: RecipeFormData): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(recipesCol, {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateRecipe(
  id: string,
  data: Partial<RecipeFormData>
): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const recipe = await fetchRecipe(id);
  await deleteDoc(doc(db, "recipes", id));

  if (recipe?.imageUrls.length) {
    await Promise.allSettled(recipe.imageUrls.map(deleteRecipeImage));
  }
}

export async function incrementCookedCount(id: string): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    cookedCount: increment(1),
    updatedAt: Timestamp.now(),
  });
}

// --- Tags ---

export async function fetchTags(): Promise<Tag[]> {
  const q = query(tagsCol, orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTag(d.id, d.data()));
}

export async function createTag(
  name: string,
  color: string
): Promise<string> {
  const docRef = await addDoc(tagsCol, { name, color });
  return docRef.id;
}

export async function deleteTag(id: string): Promise<void> {
  const recipesWithTag = await getDocs(
    query(recipesCol, where("tags", "array-contains", id))
  );

  if (!recipesWithTag.empty) {
    const batch = writeBatch(db);
    for (const snap of recipesWithTag.docs) {
      const currentTags: string[] = snap.data().tags ?? [];
      batch.update(snap.ref, {
        tags: currentTags.filter((t) => t !== id),
      });
    }
    batch.delete(doc(db, "tags", id));
    await batch.commit();
  } else {
    await deleteDoc(doc(db, "tags", id));
  }
}

// --- Pantry ---

export async function fetchPantryItems(): Promise<PantryItem[]> {
  const q = query(pantryCol, orderBy("name"));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => docToPantryItem(d.id, d.data()));
  return items.sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );
}

export async function addPantryItem(
  item: Omit<PantryItem, "id" | "addedAt">
): Promise<string> {
  const docRef = await addDoc(pantryCol, {
    ...item,
    addedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updatePantryItem(
  id: string,
  data: Partial<PantryItem>
): Promise<void> {
  const { id: _, ...rest } = data;
  await updateDoc(doc(db, "pantry", id), rest);
}

export async function deletePantryItem(id: string): Promise<void> {
  const snap = await getDoc(doc(db, "pantry", id));
  const imageUrl = snap.exists() ? snap.data().imageUrl : null;
  await deleteDoc(doc(db, "pantry", id));
  if (imageUrl) {
    const { deletePantryImage } = await import("./storage");
    await deletePantryImage(imageUrl);
  }
}
