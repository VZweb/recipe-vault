import { useCallback, useEffect, useState } from "react";
import {
  fetchRecipes,
  fetchRecipeForScope,
  createRecipe,
  updateRecipe,
  createSharedRecipe,
  updateSharedRecipe,
  deleteRecipe,
  deleteSharedRecipe,
  incrementCookedCount,
  decrementCookedCount,
} from "@/lib/firestore";
import type { Recipe, RecipeFormData, RecipeScope } from "@/types/recipe";

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

export function useRecipe(
  id: string | undefined,
  scope: RecipeScope = "vault"
) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRecipeForScope(id, scope)
      .then(setRecipe)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load recipe")
      )
      .finally(() => setLoading(false));
  }, [id, scope]);

  return { recipe, loading, error };
}

export function useRecipeMutations() {
  const create = async (data: RecipeFormData) => {
    return createRecipe(data);
  };

  const createShared = async (
    data: RecipeFormData,
    tagNames: string[],
    categoryName: string | null,
    predeterminedId?: string
  ) => {
    return createSharedRecipe(data, tagNames, categoryName, predeterminedId);
  };

  const update = async (
    id: string,
    data: Partial<RecipeFormData>,
    options?: {
      scope?: RecipeScope;
      tagNames?: string[];
      categoryName?: string | null;
    }
  ) => {
    if (options?.scope === "library") {
      return updateSharedRecipe(
        id,
        data,
        options.tagNames,
        options.categoryName
      );
    }
    return updateRecipe(id, data);
  };

  const remove = async (id: string, scope: RecipeScope = "vault") => {
    if (scope === "library") return deleteSharedRecipe(id);
    return deleteRecipe(id);
  };

  const incrementCooked = async (id: string, scope: RecipeScope = "vault") => {
    return incrementCookedCount(id, scope);
  };

  const decrementCooked = async (id: string, scope: RecipeScope = "vault") => {
    return decrementCookedCount(id, scope);
  };

  return {
    create,
    createShared,
    update,
    remove,
    incrementCooked,
    decrementCooked,
  };
}
