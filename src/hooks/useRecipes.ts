import { useCallback, useEffect, useState } from "react";
import {
  fetchRecipes,
  fetchRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  incrementCookedCount,
} from "@/lib/firestore";
import type { Recipe, RecipeFormData } from "@/types/recipe";

export function useRecipes(tagFilter?: string[], categoryFilter?: string) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecipes(
        tagFilter && tagFilter.length > 0 ? tagFilter : undefined,
        categoryFilter
      );
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }, [tagFilter, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return { recipes, loading, error, refresh: load };
}

export function useRecipe(id: string | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRecipe(id)
      .then(setRecipe)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load recipe")
      )
      .finally(() => setLoading(false));
  }, [id]);

  return { recipe, loading, error };
}

export function useRecipeMutations() {
  const create = async (data: RecipeFormData) => {
    return createRecipe(data);
  };

  const update = async (id: string, data: Partial<RecipeFormData>) => {
    return updateRecipe(id, data);
  };

  const remove = async (id: string) => {
    return deleteRecipe(id);
  };

  const incrementCooked = async (id: string) => {
    return incrementCookedCount(id);
  };

  return { create, update, remove, incrementCooked };
}
