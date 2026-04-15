import Fuse from "fuse.js";
import type { Recipe } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";

export interface SearchableRecipe extends Recipe {
  tagNames: string[];
  categoryName: string;
  ingredientNames: string;
}

export function buildSearchIndex(
  recipes: Recipe[],
  tags: Tag[],
  categories: Category[] = []
) {
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const searchable: SearchableRecipe[] = recipes.map((r) => ({
    ...r,
    tagNames: r.tags
      .map((tid) => tagMap.get(tid))
      .filter((n): n is string => !!n),
    categoryName: (r.categoryId && catMap.get(r.categoryId)) || "",
    ingredientNames: r.ingredients.map((i) => i.name).join(" "),
  }));

  return new Fuse(searchable, {
    keys: [
      { name: "title", weight: 3 },
      { name: "description", weight: 1 },
      { name: "ingredientNames", weight: 2 },
      { name: "tagNames", weight: 2 },
      { name: "categoryName", weight: 2 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}
