import type { NavigateFunction } from "react-router-dom";
import type { MasterIngredientScope } from "@/types/ingredientRef";
import type { Ingredient } from "@/types/recipe";

/** Passed through router `location.state` so seeding survives batched navigation before React commits. */
export type SuggestionsSeed = { masterId: string; scope: MasterIngredientScope };

export type SuggestionsLocationState = { suggestionsSeed?: SuggestionsSeed };

function suggestionsSearchParams(
  masterIngredientId: string,
  scope: MasterIngredientScope
): string {
  const id = masterIngredientId.trim();
  const q = new URLSearchParams();
  q.set("masterId", id);
  if (scope === "catalog") q.set("scope", "catalog");
  else if (scope === "custom") q.set("scope", "custom");
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Path + query for opening Suggestions with one ingredient as an extra (same as manual “extra ingredients”).
 * `scope` omitted or empty encodes legacy-null masters (`?:id` bucket).
 */
export function buildSuggestionsUrl(
  masterIngredientId: string,
  scope: MasterIngredientScope
): string {
  return `/suggestions${suggestionsSearchParams(masterIngredientId, scope)}`;
}

/** Sets URL query and `location.state.suggestionsSeed` so `SuggestionsPage` can apply extras even if the query is stripped before paint. */
export function navigateToSuggestionsForIngredient(
  navigate: NavigateFunction,
  masterIngredientId: string,
  scope: MasterIngredientScope
): void {
  const id = masterIngredientId.trim();
  navigate(
    {
      pathname: "/suggestions",
      search: suggestionsSearchParams(id, scope),
    },
    {
      state: {
        suggestionsSeed: { masterId: id, scope } as SuggestionsSeed,
      },
    }
  );
}

export function parseSuggestionIngredientParams(
  params: URLSearchParams
): { masterId: string; scope: MasterIngredientScope } | null {
  const masterId = params.get("masterId")?.trim();
  if (!masterId) return null;
  const scopeRaw = params.get("scope");
  if (scopeRaw === "catalog") return { masterId, scope: "catalog" };
  if (scopeRaw === "custom") return { masterId, scope: "custom" };
  if (scopeRaw === null || scopeRaw === "") return { masterId, scope: null };
  return null;
}

/** Primary master when present; otherwise first substitute with a master link. */
export function recipeLineSuggestionMaster(
  ing: Pick<Ingredient, "masterIngredientId" | "masterIngredientScope" | "substituteLinks">
): { masterId: string; scope: MasterIngredientScope } | null {
  const primary = ing.masterIngredientId?.trim();
  if (primary) {
    return { masterId: primary, scope: ing.masterIngredientScope };
  }
  for (const sub of ing.substituteLinks ?? []) {
    const sid = sub.masterIngredientId?.trim();
    if (sid) {
      return { masterId: sid, scope: sub.masterIngredientScope };
    }
  }
  return null;
}
