import {
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
  limit,
  increment,
  Timestamp,
  runTransaction,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { DEFAULT_CATEGORIES, DEFAULT_TAGS } from "@/data/defaultVaultTemplates";
import { db, refreshAuthIdToken, requireUid } from "./firebase";
import { deleteRecipeImage, deletePantryImage } from "./storage";
import type { MasterIngredientScope } from "@/types/ingredientRef";
import type { Recipe, RecipeFormData } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import type { PantryItem } from "@/types/pantry";
import type { MasterIngredient } from "@/types/ingredient";
import {
  getIngredientCatalogCollection,
  getUserCategoriesCollection,
  getUserCustomIngredientsCollection,
  getUserDocRef,
  getUserPantryCollection,
  getUserRecipesCollection,
  getUserTagsCollection,
} from "./firestorePaths";
import { parseExpiresOnParts } from "./pantryExpiry";

function toDate(ts: Timestamp | Date | undefined): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date();
}

function normalizeIngredientScope(raw: unknown): MasterIngredientScope {
  if (raw === "catalog" || raw === "custom") return raw;
  return null;
}

function normalizeSubstituteLinks(raw: unknown): {
  masterIngredientId: string;
  masterIngredientScope: MasterIngredientScope;
}[] {
  if (!Array.isArray(raw)) return [];
  const out: { masterIngredientId: string; masterIngredientScope: MasterIngredientScope }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id =
      typeof o.masterIngredientId === "string" ? o.masterIngredientId.trim() : "";
    if (!id) continue;
    out.push({
      masterIngredientId: id,
      masterIngredientScope: normalizeIngredientScope(o.masterIngredientScope),
    });
  }
  return out;
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
      masterIngredientScope: normalizeIngredientScope(ing.masterIngredientScope),
      substituteLinks: normalizeSubstituteLinks(ing.substituteLinks),
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

function normalizeExpiresOnField(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return parseExpiresOnParts(s) ? s : null;
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
    masterIngredientScope: normalizeIngredientScope(data.masterIngredientScope),
    note: data.note ?? "",
    expiresOn: normalizeExpiresOnField(data.expiresOn),
    isOpened: data.isOpened === true,
    addedAt: toDate(data.addedAt),
  };
}

function docToCatalogIngredient(id: string, data: DocumentData): MasterIngredient {
  return {
    id,
    name: data.name ?? "",
    nameGr: data.nameGr ?? "",
    aliases: data.aliases ?? [],
    category: data.category ?? "Other",
    isCatalog: true,
  };
}

function docToCustomIngredient(id: string, data: DocumentData): MasterIngredient {
  return {
    id,
    name: data.name ?? "",
    nameGr: data.nameGr ?? "",
    aliases: data.aliases ?? [],
    category: data.category ?? "Other",
    isCatalog: false,
  };
}

// --- Recipes ---

export async function fetchRecipes(
  tagIds?: string[],
  categoryId?: string
): Promise<Recipe[]> {
  const uid = requireUid();
  const recipesCol = getUserRecipesCollection(db, uid);
  let q;

  if (tagIds && tagIds.length > 0) {
    q = query(
      recipesCol,
      where("tags", "array-contains", tagIds[0])
    );
  } else if (categoryId) {
    q = query(recipesCol, where("categoryId", "==", categoryId));
  } else {
    q = query(recipesCol, orderBy("createdAt", "desc"));
  }

  const snap = await getDocs(q);
  let recipes = snap.docs.map((d) => docToRecipe(d.id, d.data()));

  if (tagIds && tagIds.length > 1) {
    recipes = recipes.filter((r) =>
      tagIds.every((id) => r.tags.includes(id))
    );
  }

  if (categoryId && tagIds && tagIds.length > 0) {
    recipes = recipes.filter((r) => r.categoryId === categoryId);
  }

  recipes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return recipes;
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const uid = requireUid();
  const snap = await getDoc(doc(getUserRecipesCollection(db, uid), id));
  if (!snap.exists()) return null;
  return docToRecipe(snap.id, snap.data());
}

export async function createRecipe(data: RecipeFormData): Promise<string> {
  const uid = requireUid();
  const now = Timestamp.now();
  const docRef = await addDoc(getUserRecipesCollection(db, uid), {
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
  const uid = requireUid();
  await updateDoc(doc(getUserRecipesCollection(db, uid), id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const recipe = await fetchRecipe(id);
  const uid = requireUid();
  await deleteDoc(doc(getUserRecipesCollection(db, uid), id));

  if (recipe?.imageUrls.length) {
    await Promise.allSettled(recipe.imageUrls.map(deleteRecipeImage));
  }
}

export async function incrementCookedCount(id: string): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(getUserRecipesCollection(db, uid), id), {
    cookedCount: increment(1),
    updatedAt: Timestamp.now(),
  });
}

/** Does nothing if cookedCount is already 0 (no negative counts). */
export async function decrementCookedCount(id: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(getUserRecipesCollection(db, uid), id);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const raw = snap.data().cookedCount;
    const current = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (current <= 0) return;
    transaction.update(ref, {
      cookedCount: current - 1,
      updatedAt: Timestamp.now(),
    });
  });
}

// --- Tags ---

export async function fetchTags(): Promise<Tag[]> {
  const uid = requireUid();
  const q = query(getUserTagsCollection(db, uid), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTag(d.id, d.data()));
}

export async function createTag(
  name: string,
  color: string,
  category: string = "Other"
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(getUserTagsCollection(db, uid), {
    name,
    color,
    category,
  });
  return docRef.id;
}

export async function updateTag(
  id: string,
  fields: { name?: string; color?: string; category?: string }
): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(getUserTagsCollection(db, uid), id), fields);
}

export async function deleteTag(id: string): Promise<void> {
  const uid = requireUid();
  const recipesCol = getUserRecipesCollection(db, uid);
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
    batch.delete(doc(getUserTagsCollection(db, uid), id));
    await batch.commit();
  } else {
    await deleteDoc(doc(getUserTagsCollection(db, uid), id));
  }
}

// --- Categories ---

export async function fetchCategories(): Promise<Category[]> {
  const uid = requireUid();
  const q = query(getUserCategoriesCollection(db, uid), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToCategory(d.id, d.data()));
}

export async function createCategory(
  name: string,
  icon: string,
  description: string = ""
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(getUserCategoriesCollection(db, uid), {
    name,
    icon,
    description,
  });
  return docRef.id;
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, "id">>
): Promise<void> {
  const uid = requireUid();
  await updateDoc(doc(getUserCategoriesCollection(db, uid), id), data);
}

export async function deleteCategory(id: string): Promise<void> {
  const uid = requireUid();
  const recipesCol = getUserRecipesCollection(db, uid);
  const recipesWithCategory = await getDocs(
    query(recipesCol, where("categoryId", "==", id))
  );

  if (!recipesWithCategory.empty) {
    const batch = writeBatch(db);
    for (const snap of recipesWithCategory.docs) {
      batch.update(snap.ref, { categoryId: null });
    }
    batch.delete(doc(getUserCategoriesCollection(db, uid), id));
    await batch.commit();
  } else {
    await deleteDoc(doc(getUserCategoriesCollection(db, uid), id));
  }
}

/**
 * One-time per account: copies default tags and categories when the vault has none
 * (or only one side missing). Writes `users/{uid}` with `vaultDefaultsApplied`.
 * @returns true if new documents were created (caller may invalidate tag/category queries).
 */
export async function ensureUserVaultDefaults(): Promise<boolean> {
  const uid = requireUid();
  const profileRef = getUserDocRef(db, uid);
  const profileSnap = await getDoc(profileRef);
  if (profileSnap.exists() && profileSnap.data()?.vaultDefaultsApplied === true) {
    return false;
  }

  const tagsCol = getUserTagsCollection(db, uid);
  const categoriesCol = getUserCategoriesCollection(db, uid);

  const [tagProbe, catProbe] = await Promise.all([
    getDocs(query(tagsCol, limit(1))),
    getDocs(query(categoriesCol, limit(1))),
  ]);
  const hasTags = !tagProbe.empty;
  const hasCats = !catProbe.empty;

  if (hasTags && hasCats) {
    if (!profileSnap.exists()) {
      await setDoc(profileRef, { vaultDefaultsApplied: true }, { merge: true });
    }
    return false;
  }

  await runTransaction(db, async (transaction) => {
    const p = await transaction.get(profileRef);
    if (p.exists() && p.data()?.vaultDefaultsApplied === true) {
      return;
    }

    if (!hasTags) {
      for (const t of DEFAULT_TAGS) {
        const ref = doc(tagsCol);
        transaction.set(ref, {
          name: t.name,
          color: t.color,
          category: t.category,
        });
      }
    }
    if (!hasCats) {
      for (const c of DEFAULT_CATEGORIES) {
        const ref = doc(categoriesCol);
        transaction.set(ref, {
          name: c.name,
          description: c.description,
          icon: c.icon,
        });
      }
    }
    transaction.set(
      profileRef,
      { vaultDefaultsApplied: true, seededAt: Timestamp.now() },
      { merge: true }
    );
  });

  const after = await getDoc(profileRef);
  return after.exists() && after.data()?.vaultDefaultsApplied === true;
}

// --- Pantry ---

export async function fetchPantryItems(): Promise<PantryItem[]> {
  const uid = requireUid();
  const q = query(getUserPantryCollection(db, uid), orderBy("name"));
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
  const docRef = await addDoc(getUserPantryCollection(db, uid), {
    ...item,
    addedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updatePantryItem(
  id: string,
  data: Partial<PantryItem>
): Promise<void> {
  const uid = requireUid();
  const { id: _, ...rest } = data;
  const payload = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  ) as Partial<PantryItem>;
  await updateDoc(doc(getUserPantryCollection(db, uid), id), payload);
}

/**
 * Restock / new purchase: keeps identity (name, catalog link, category, staple flag),
 * clears quantity, unit, note, expiry, opened flag and image, sets `addedAt` to now.
 * Removes the previous Storage image after the document update succeeds.
 */
export async function refreshPantryItem(id: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(getUserPantryCollection(db, uid), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const rawUrl = snap.data().imageUrl;
  const prevImage =
    typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : null;

  await updateDoc(ref, {
    quantity: null,
    unit: null,
    note: "",
    expiresOn: null,
    isOpened: false,
    imageUrl: null,
    addedAt: Timestamp.now(),
  });

  if (prevImage) {
    await deletePantryImage(prevImage);
  }
}

export async function deletePantryItem(id: string): Promise<void> {
  const uid = requireUid();
  const pantryRef = getUserPantryCollection(db, uid);
  const snap = await getDoc(doc(pantryRef, id));
  const imageUrl = snap.exists() ? snap.data().imageUrl : null;
  await deleteDoc(doc(pantryRef, id));
  if (imageUrl) {
    await deletePantryImage(imageUrl);
  }
}

// --- Master Ingredients (catalog + user-owned) ---

export async function fetchMasterIngredients(): Promise<MasterIngredient[]> {
  const uid = requireUid();
  const [catSnap, userSnap] = await Promise.all([
    getDocs(query(getIngredientCatalogCollection(db), orderBy("name"))),
    getDocs(
      query(getUserCustomIngredientsCollection(db, uid), orderBy("name"))
    ),
  ]);
  const merged: MasterIngredient[] = [
    ...catSnap.docs.map((d) => docToCatalogIngredient(d.id, d.data())),
    ...userSnap.docs.map((d) => docToCustomIngredient(d.id, d.data())),
  ];
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addMasterIngredient(
  item: Omit<MasterIngredient, "id" | "isCatalog">
): Promise<string> {
  const uid = requireUid();
  const docRef = await addDoc(getUserCustomIngredientsCollection(db, uid), {
    name: item.name,
    nameGr: item.nameGr,
    aliases: item.aliases,
    category: item.category,
  });
  return docRef.id;
}

/**
 * Shared catalog row; requires `catalogAdmin` custom claim (Firestore rules).
 * TODO: Add server/admin moderation flow if non-client catalog edits are required.
 */
export async function addCatalogMasterIngredient(
  item: Omit<MasterIngredient, "id" | "isCatalog">
): Promise<string> {
  requireUid();
  await refreshAuthIdToken();
  const docRef = await addDoc(getIngredientCatalogCollection(db), {
    name: item.name,
    nameGr: item.nameGr,
    aliases: item.aliases,
    category: item.category,
  });
  return docRef.id;
}

export async function updateMasterIngredient(
  id: string,
  data: Partial<Omit<MasterIngredient, "id" | "isCatalog">>,
  isCatalog: boolean
): Promise<void> {
  const uid = requireUid();
  const ref = isCatalog
    ? doc(getIngredientCatalogCollection(db), id)
    : doc(getUserCustomIngredientsCollection(db, uid), id);
  await updateDoc(ref, data);
}

export async function deleteMasterIngredient(
  id: string,
  isCatalog: boolean
): Promise<void> {
  const uid = requireUid();
  const ref = isCatalog
    ? doc(getIngredientCatalogCollection(db), id)
    : doc(getUserCustomIngredientsCollection(db, uid), id);
  await deleteDoc(ref);
}
