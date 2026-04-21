import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";

export function getUserDocRef(db: Firestore, uid: string): DocumentReference {
  return doc(db, "users", uid);
}

export function getUserRecipesCollection(
  db: Firestore,
  uid: string
): CollectionReference {
  return collection(db, "users", uid, "recipes");
}

export function getUserPantryCollection(
  db: Firestore,
  uid: string
): CollectionReference {
  return collection(db, "users", uid, "pantry");
}

export function getUserCategoriesCollection(
  db: Firestore,
  uid: string
): CollectionReference {
  return collection(db, "users", uid, "categories");
}

export function getUserTagsCollection(db: Firestore, uid: string): CollectionReference {
  return collection(db, "users", uid, "tags");
}

export function getUserCustomIngredientsCollection(
  db: Firestore,
  uid: string
): CollectionReference {
  return collection(db, "users", uid, "customIngredients");
}

export function getIngredientCatalogCollection(
  db: Firestore
): CollectionReference {
  return collection(db, "ingredientCatalog");
}
