import Fuse from "fuse.js";
import type { Recipe } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import type { MasterIngredient } from "@/types/ingredient";
import { ingredientLinkKey, resolveMasterIngredient } from "@/lib/ingredientRef";

export interface SearchableRecipe extends Recipe {
  tagNames: string[];
  categoryName: string;
  ingredientNames: string;
}

export function buildSearchIndex(
  recipes: Recipe[],
  tags: Tag[],
  categories: Category[] = [],
  masterIngredients: MasterIngredient[] = []
) {
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const searchable: SearchableRecipe[] = recipes.map((r) => ({
    ...r,
    tagNames: r.tags
      .map((tid) => tagMap.get(tid))
      .filter((n): n is string => !!n),
    categoryName: (r.categoryId && catMap.get(r.categoryId)) || "",
    ingredientNames: r.ingredients
      .filter((i) => !i.isSection)
      .flatMap((i) => {
        const names = [i.name];
        if (i.nameSecondary) names.push(i.nameSecondary);
        const master = resolveMasterIngredient(
          i.masterIngredientId,
          i.masterIngredientScope,
          masterIngredients
        );
        if (master) {
          if (master.nameGr && !names.includes(master.nameGr))
            names.push(master.nameGr);
          names.push(...master.aliases);
        }
        for (const sub of i.substituteLinks ?? []) {
          if (!ingredientLinkKey(sub.masterIngredientId, sub.masterIngredientScope))
            continue;
          const sm = resolveMasterIngredient(
            sub.masterIngredientId,
            sub.masterIngredientScope,
            masterIngredients
          );
          if (sm) {
            names.push(sm.name);
            if (sm.nameGr && !names.includes(sm.nameGr)) names.push(sm.nameGr);
            names.push(...sm.aliases);
          }
        }
        return names;
      })
      .join(" "),
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
