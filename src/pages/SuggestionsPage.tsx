import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, Clock, Percent, Users } from "lucide-react";
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

  const allAvailable = useMemo(
    () => [
      ...pantryItems.flatMap((p) =>
        p.nameSecondary ? [p.name, p.nameSecondary] : [p.name]
      ),
      ...extraIngredients.flatMap((e) =>
        e.nameSecondary ? [e.name, e.nameSecondary] : [e.name]
      ),
    ],
    [pantryItems, extraIngredients]
  );

  const combinedPantry = useMemo<PantryItem[]>(
    () => [
      ...pantryItems,
      ...extraIngredients
        .filter((e) => e.masterIngredientId)
        .map((e) => ({
          id: `extra-${e.masterIngredientId}`,
          name: e.name,
          nameSecondary: e.nameSecondary || null,
          normalizedName: e.name.toLowerCase(),
          category: "Other" as const,
          quantity: null,
          unit: null,
          isStaple: false,
          imageUrl: null,
          masterIngredientId: e.masterIngredientId,
          note: "",
          addedAt: new Date(),
        })),
    ],
    [pantryItems, extraIngredients]
  );

  const suggestions = useMemo(
    () => suggestRecipes(recipes, allAvailable, combinedPantry),
    [recipes, allAvailable, combinedPantry]
  );

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const name = extraIngredient.trim();
    if (!name) return;
    setExtraIngredients((prev) => [
      ...prev,
      {
        name: pendingExtra.masterIngredientId ? pendingExtra.name : name,
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
      <h1 className="text-2xl font-bold text-stone-800">What Can I Cook?</h1>
      <p className="text-sm text-stone-500">
        Based on your pantry ({pantryItems.length} items) and any extra
        ingredients you add below.
      </p>

      {/* Extra ingredient input */}
      <form
        onSubmit={handleAddExtra}
        className="flex gap-2"
      >
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
        <Button type="submit" variant="secondary" disabled={!extraIngredient.trim()}>
          Add
        </Button>
      </form>

      {extraIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-stone-500 self-center">Extra:</span>
          {extraIngredients.map((ing, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ing.masterIngredientId
                  ? "bg-brand-50 text-brand-700"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
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
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((s) => (
            <SuggestionCard key={s.recipe.id} suggestion={s} tags={tags} />
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
}: {
  suggestion: SuggestionResult;
  tags: { id: string; name: string; color: string }[];
}) {
  const recipeTags = allTags.filter((t) => s.recipe.tags.includes(t.id));
  const totalTime =
    (s.recipe.prepTimeMin ?? 0) + (s.recipe.cookTimeMin ?? 0) || null;

  return (
    <Link
      to={`/recipes/${s.recipe.id}`}
      className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
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
          <h3 className="font-semibold text-stone-900 truncate">
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
