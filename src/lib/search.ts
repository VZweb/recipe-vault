import Fuse from "fuse.js";
import type { Recipe } from "@/types/recipe";
import type { Tag } from "@/types/tag";

export interface SearchableRecipe extends Recipe {
  tagNames: string[];
  ingredientNames: string;
}

export function buildSearchIndex(recipes: Recipe[], tags: Tag[]) {
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  const searchable: SearchableRecipe[] = recipes.map((r) => ({
    ...r,
    tagNames: r.tags
      .map((tid) => tagMap.get(tid))
      .filter((n): n is string => !!n),
    ingredientNames: r.ingredients.map((i) => i.name).join(" "),
  }));

  return new Fuse(searchable, {
    keys: [
      { name: "title", weight: 3 },
      { name: "description", weight: 1 },
      { name: "ingredientNames", weight: 2 },
      { name: "tagNames", weight: 2 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}
