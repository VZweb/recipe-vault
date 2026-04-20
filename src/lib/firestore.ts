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
import { db, refreshAuthIdToken, requireUid } from "./firebase";
import { deleteRecipeImage } from "./storage";
import type { Recipe, RecipeFormData } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import type { PantryItem } from "@/types/pantry";
import type { MasterIngredient } from "@/types/ingredient";

const recipesCol = collection(db, "recipes");
const tagsCol = collection(db, "tags");
const categoriesCol = collection(db, "categories");
const pantryCol = collection(db, "pantry");
const ingredientsCol = collection(db, "ingredients");

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
    categoryId: data.categoryId ?? null,
    tags: data.tags ?? [],
    ingredients: (data.ingredients ?? []).map((ing: Record<string, unknown>) => ({
      ...ing,
      nameSecondary: ing.nameSecondary ?? "",
      masterIngredientId: ing.masterIngredientId ?? null,
      note: (ing.note as string) ?? "",
      isSection: (ing.isSection as boolean) ?? false,
    })),
    steps: data.steps ?? [],
    notes: data.notes ?? "",
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
    category: data.category ?? "Other",
  };
}

function docToCategory(id: string, data: DocumentData): Category {
  return {
    id,
    name: data.name ?? "",
    description: data.description ?? "",
    icon: data.icon ?? "utensils",
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
    masterIngredientId: data.masterIngredientId ?? "",
    note: data.note ?? "",
    addedAt: toDate(data.addedAt),
  };
}

function docToMasterIngredient(id: string, data: DocumentData): MasterIngredient {
  return {
    id,
    name: data.name ?? "",
    nameGr: data.nameGr ?? "",
    aliases: data.aliases ?? [],
    category: data.category ?? "Other",
    isCatalog: data.catalog === true,
  };
}

// --- Recipes ---

export async function fetchRecipes(
  tagIds?: string[],
  categoryId?: string
): Promise<Recipe[]> {
  const uid = requireUid();
  let q;

  if (tagIds && tagIds.length > 0 && tagIds.length <= 10) {
    q = query(
      recipesCol,
      where("ownerId", "==", uid),
      where("tags", "array-contains-any", tagIds)
    );
  } else if (categoryId) {
    q = query(
      recipesCol,
      where("ownerId", "==", uid),
      where("categoryId", "==", categoryId)
    );
  } else {
    q = query(recipesCol, where("ownerId", "==", uid), orderBy("createdAt", "desc"));
  }

  const snap = await getDocs(q);
  let recipes = snap.docs.map((d) => docToRecipe(d.id, d.data()));

  if (categoryId && tagIds && tagIds.length > 0) {
    recipes = recipes.filter((r) => r.categoryId === categoryId);
  }

  recipes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return recipes;
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "recipes", id));
  if (!snap.exists()) return null;
  return docToRecipe(snap.id, snap.data());
}

export async function createRecipe(data: RecipeFormData): Promise<string> {
  const uid = requireUid();
  const now = Timestamp.now();
  const docRef = await addDoc(recipesCol, {
    ...data,
    ownerId: uid,
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
  const uid = requireUid();
  const q = query(tagsCol, where("ownerId", "==", uid), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTag(d.id, d.data()));
}

export async function createTag(
  name: string,
  color: string,
  category: string = "Other"
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(tagsCol, { name, color, category, ownerId: uid });
  return docRef.id;
}

export async function updateTag(
  id: string,
  fields: { name?: string; color?: string; category?: string }
): Promise<void> {
  await updateDoc(doc(db, "tags", id), fields);
}

export async function deleteTag(id: string): Promise<void> {
  const uid = requireUid();
  const recipesWithTag = await getDocs(
    query(
      recipesCol,
      where("ownerId", "==", uid),
      where("tags", "array-contains", id)
    )
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

// --- Categories ---

export async function fetchCategories(): Promise<Category[]> {
  const uid = requireUid();
  const q = query(categoriesCol, where("ownerId", "==", uid), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToCategory(d.id, d.data()));
}

export async function createCategory(
  name: string,
  icon: string,
  description: string = ""
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(categoriesCol, {
    name,
    icon,
    description,
    ownerId: uid,
  });
  return docRef.id;
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, "id">>
): Promise<void> {
  await updateDoc(doc(db, "categories", id), data);
}

export async function deleteCategory(id: string): Promise<void> {
  const uid = requireUid();
  const recipesWithCategory = await getDocs(
    query(
      recipesCol,
      where("ownerId", "==", uid),
      where("categoryId", "==", id)
    )
  );

  if (!recipesWithCategory.empty) {
    const batch = writeBatch(db);
    for (const snap of recipesWithCategory.docs) {
      batch.update(snap.ref, { categoryId: null });
    }
    batch.delete(doc(db, "categories", id));
    await batch.commit();
  } else {
    await deleteDoc(doc(db, "categories", id));
  }
}

// --- Pantry ---

export async function fetchPantryItems(): Promise<PantryItem[]> {
  const uid = requireUid();
  const q = query(pantryCol, where("ownerId", "==", uid), orderBy("name"));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => docToPantryItem(d.id, d.data()));
  return items.sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );
}

export async function addPantryItem(
  item: Omit<PantryItem, "id" | "addedAt">
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(pantryCol, {
    ...item,
    ownerId: uid,
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

// --- Master Ingredients (catalog + user-owned) ---

export async function fetchMasterIngredients(): Promise<MasterIngredient[]> {
  const uid = requireUid();
  const [catSnap, userSnap] = await Promise.all([
    getDocs(query(ingredientsCol, where("catalog", "==", true), orderBy("name"))),
    getDocs(query(ingredientsCol, where("ownerId", "==", uid), orderBy("name"))),
  ]);
  const merged = new Map<string, MasterIngredient>();
  for (const d of catSnap.docs) {
    merged.set(d.id, docToMasterIngredient(d.id, d.data()));
  }
  for (const d of userSnap.docs) {
    merged.set(d.id, docToMasterIngredient(d.id, d.data()));
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function addMasterIngredient(
  item: Omit<MasterIngredient, "id" | "isCatalog">
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(ingredientsCol, {
    name: item.name,
    nameGr: item.nameGr,
    aliases: item.aliases,
    category: item.category,
    ownerId: uid,
    catalog: false,
  });
  return docRef.id;
}

/** Shared catalog row; requires `catalogAdmin` custom claim (Firestore rules). */
export async function addCatalogMasterIngredient(
  item: Omit<MasterIngredient, "id" | "isCatalog">
): Promise<string> {
  requireUid();
  await refreshAuthIdToken();
  const docRef = await addDoc(ingredientsCol, {
    name: item.name,
    nameGr: item.nameGr,
    aliases: item.aliases,
    category: item.category,
    catalog: true,
  });
  return docRef.id;
}

export async function updateMasterIngredient(
  id: string,
  data: Partial<Omit<MasterIngredient, "id" | "isCatalog">>
): Promise<void> {
  await updateDoc(doc(db, "ingredients", id), data);
}

export async function deleteMasterIngredient(id: string): Promise<void> {
  await deleteDoc(doc(db, "ingredients", id));
}
