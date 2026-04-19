import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, Clock, Info, Link2, Percent, Users } from "lucide-react";
import { useRecipes } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useIngredients } from "@/hooks/useIngredients";
import { fetchPantryItems } from "@/lib/firestore";
import { suggestRecipes, type SuggestionResult } from "@/lib/suggestions";
import { Button } from "@/components/ui/Button";
import { TagChip } from "@/components/ui/TagChip";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { IngredientAutocomplete } from "@/components/ui/IngredientAutocomplete";
import type { PantryItem } from "@/types/pantry";

interface ExtraIngredient {
  name: string;
  nameSecondary: string;
  masterIngredientId: string | null;
}

export function SuggestionsPage() {
  const { recipes, loading: loadingRecipes } = useRecipes();
  const { tags } = useTags();
  const { ingredients: masterIngredients } = useIngredients();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loadingPantry, setLoadingPantry] = useState(true);
  const [extraIngredient, setExtraIngredient] = useState("");
  const [extraIngredients, setExtraIngredients] = useState<ExtraIngredient[]>([]);
  const [pendingExtra, setPendingExtra] = useState<ExtraIngredient>({
    name: "",
    nameSecondary: "",
    masterIngredientId: null,
  });

  const loadPantry = useCallback(async () => {
    setLoadingPantry(true);
    try {
      const data = await fetchPantryItems();
      setPantryItems(data);
    } finally {
      setLoadingPantry(false);
    }
  }, []);

  useEffect(() => {
    void loadPantry();
  }, [loadPantry]);

  const combinedPantry = useMemo<PantryItem[]>(
    () => [
      ...pantryItems,
      ...extraIngredients.map((e, i) => ({
        id: e.masterIngredientId ? `extra-${e.masterIngredientId}` : `extra-freeform-${i}`,
        name: e.name,
        nameSecondary: e.nameSecondary || null,
        normalizedName: e.name.toLowerCase(),
        category: "Other" as const,
        quantity: null,
        unit: null,
        isStaple: false,
        imageUrl: null,
        masterIngredientId: e.masterIngredientId ?? "",
        note: "",
        addedAt: new Date(),
      })),
    ],
    [pantryItems, extraIngredients]
  );

  const suggestions = useMemo(
    () => suggestRecipes(recipes, combinedPantry),
    [recipes, combinedPantry]
  );

  const matchedExtrasPerRecipe = useMemo(() => {
    if (extraIngredients.length === 0) return new Map<string, string[]>();
    const extraById = new Map(
      extraIngredients
        .filter((e) => e.masterIngredientId)
        .map((e) => [e.masterIngredientId!, e.name])
    );

    const map = new Map<string, string[]>();
    for (const s of suggestions) {
      const hits: string[] = [];
      for (const ing of s.recipe.ingredients) {
        if (ing.isSection) continue;
        if (!s.matchedIngredients.includes(ing.name)) continue;
        if (ing.masterIngredientId && extraById.has(ing.masterIngredientId)) {
          const name = extraById.get(ing.masterIngredientId)!;
          if (!hits.includes(name)) hits.push(name);
        }
      }
      if (hits.length > 0) map.set(s.recipe.id, hits);
    }
    return map;
  }, [extraIngredients, suggestions]);

  const unmatchedExtras = useMemo(() => {
    if (extraIngredients.length === 0) return [];
    const matchedExtraNames = new Set(
      Array.from(matchedExtrasPerRecipe.values()).flat().map((n) => n.toLowerCase())
    );
    return extraIngredients.filter(
      (e) => !matchedExtraNames.has(e.name.toLowerCase())
    );
  }, [extraIngredients, matchedExtrasPerRecipe]);

  const noRecipeWithAllExtras = useMemo(() => {
    if (extraIngredients.length < 2) return false;
    const linkedCount = extraIngredients.filter((e) => e.masterIngredientId).length;
    if (linkedCount < 2) return false;
    for (const hits of matchedExtrasPerRecipe.values()) {
      if (hits.length >= linkedCount) return false;
    }
    return true;
  }, [extraIngredients, matchedExtrasPerRecipe]);

  const sortedSuggestions = useMemo(() => {
    if (extraIngredients.length === 0) return suggestions;
    const extrasMap = matchedExtrasPerRecipe;
    return [...suggestions].sort((a, b) => {
      const aExtras = extrasMap.get(a.recipe.id)?.length ?? 0;
      const bExtras = extrasMap.get(b.recipe.id)?.length ?? 0;
      if (aExtras !== bExtras) return bExtras - aExtras;
      return b.matchPercentage - a.matchPercentage;
    });
  }, [suggestions, extraIngredients.length, matchedExtrasPerRecipe]);

  const pantryMasterIds = useMemo(
    () => new Set(pantryItems.map((p) => p.masterIngredientId).filter(Boolean)),
    [pantryItems]
  );

  const pantryNames = useMemo(
    () => new Set(pantryItems.map((p) => p.normalizedName)),
    [pantryItems]
  );

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingExtra.name.trim()) return;
    setExtraIngredients((prev) => [
      ...prev,
      {
        name: pendingExtra.name,
        nameSecondary: pendingExtra.nameSecondary,
        masterIngredientId: pendingExtra.masterIngredientId,
      },
    ]);
    setExtraIngredient("");
    setPendingExtra({ name: "", nameSecondary: "", masterIngredientId: null });
  };

  const loading = loadingRecipes || loadingPantry;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-stone-800">What Can I Cook?</h1>
      <p className="text-sm text-stone-500">
        Based on your pantry ({pantryItems.length} items) and any extra
        ingredients you add below.
      </p>

      {/* Extra ingredient input */}
      <form
        onSubmit={handleAddExtra}
        className="space-y-2"
      >
        <div className="flex gap-2">
          <IngredientAutocomplete
            ingredients={masterIngredients}
            value={extraIngredient}
            placeholder="Add an ingredient not in your pantry..."
            wrapperClassName="flex-1"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            onChange={(v) => {
              setExtraIngredient(v);
              setPendingExtra({ name: v, nameSecondary: "", masterIngredientId: null });
            }}
            onSelect={(mi) => {
              setExtraIngredient(mi.name);
              setPendingExtra({ name: mi.name, nameSecondary: mi.nameGr, masterIngredientId: mi.id });
            }}
          />
          <Button type="submit" variant="secondary" disabled={!pendingExtra.name.trim()}>
            Add
          </Button>
        </div>
      </form>

      {extraIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-stone-500 self-center">Extra:</span>
          {extraIngredients.map((ing, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                (ing.masterIngredientId ? pantryMasterIds.has(ing.masterIngredientId) : pantryNames.has(ing.name.toLowerCase()))
                  ? "bg-green-50 text-green-700"
                  : "bg-blue-950/10 text-blue-950"
              }`}
            >
              {ing.masterIngredientId && <Link2 size={12} className="shrink-0" />}
              {ing.name}
              <button
                onClick={() =>
                  setExtraIngredients((prev) => prev.filter((_, j) => j !== i))
                }
                className="ml-0.5 hover:opacity-70"
              >
                x
              </button>
            </span>
          ))}
          <button
            onClick={() => setExtraIngredients([])}
            className="self-center rounded-full px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : sortedSuggestions.length > 0 ? (
        <div className="space-y-4">
          {unmatchedExtras.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Info size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <p>
                No recipes found for{" "}
                <span className="font-semibold">
                  {unmatchedExtras.map((e) => e.name).join(", ")}
                </span>
                . Showing results based on your other ingredients.
              </p>
            </div>
          )}
          {noRecipeWithAllExtras && unmatchedExtras.length === 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Info size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <p>
                No single recipe contains all of{" "}
                <span className="font-semibold">
                  {extraIngredients.map((e) => e.name).join(", ")}
                </span>
                . Showing the best matches below.
              </p>
            </div>
          )}
          {sortedSuggestions.map((s) => (
            <SuggestionCard
              key={s.recipe.id}
              suggestion={s}
              tags={tags}
              matchedExtras={matchedExtrasPerRecipe.get(s.recipe.id) ?? []}
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={<ChefHat size={48} />}
          title="No recipes to suggest from"
          description="Add some recipes first, then come back here."
          action={
            <Link to="/recipes/new">
              <Button>Add Recipe</Button>
            </Link>
          }
        />
      ) : extraIngredients.length > 0 ? (
        <EmptyState
          icon={<ChefHat size={48} />}
          title="No recipes match your ingredients"
          description="None of your recipes can be made with the ingredients you selected. Try adding different ingredients or broaden your pantry."
        />
      ) : (
        <EmptyState
          icon={<ChefHat size={48} />}
          title="No matches found"
          description="Try adding more ingredients to your pantry or enter extra ingredients above."
        />
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion: s,
  tags: allTags,
  matchedExtras,
}: {
  suggestion: SuggestionResult;
  tags: { id: string; name: string; color: string }[];
  matchedExtras: string[];
}) {
  const recipeTags = allTags.filter((t) => s.recipe.tags.includes(t.id));
  const totalTime =
    (s.recipe.prepTimeMin ?? 0) + (s.recipe.cookTimeMin ?? 0) || null;
  const highlighted = matchedExtras.length > 0;

  return (
    <Link
      to={`/recipes/${s.recipe.id}`}
      className={`flex gap-4 rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${
        highlighted
          ? "border-brand-300 bg-brand-50/40 ring-1 ring-brand-200"
          : "border-stone-200 bg-white"
      }`}
    >
      {/* Image */}
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {s.recipe.imageUrls.length > 0 ? (
          <img
            src={s.recipe.imageUrls[0]}
            alt={s.recipe.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <ChefHat size={24} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-semibold text-stone-900 line-clamp-2 sm:truncate">
            {s.recipe.title}
          </h3>
          <span
            className={`flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              s.matchPercentage >= 80
                ? "bg-green-100 text-green-700"
                : s.matchPercentage >= 50
                  ? "bg-amber-100 text-amber-700"
                  : "bg-stone-100 text-stone-600"
            }`}
          >
            <Percent size={12} />
            {s.matchPercentage}
          </span>
        </div>

        <p className="mt-1 text-xs text-stone-500">
          You have{" "}
          <span className="font-medium text-brand-600">{s.matchedCount}</span>{" "}
          of {s.totalCount} ingredients
        </p>

        {s.missingIngredients.length > 0 && (
          <p className="mt-1 text-xs text-red-500">
            Missing: {s.missingIngredients.join(", ")}
          </p>
        )}

        {matchedExtras.length > 0 && (
          <p className="mt-1 text-xs font-medium text-brand-600">
            You added: {matchedExtras.join(", ")}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
          {totalTime && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {totalTime} min
            </span>
          )}
          {s.recipe.servings && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {s.recipe.servings}
            </span>
          )}
          {recipeTags.slice(0, 2).map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      </div>
    </Link>
  );
}
