import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChefHat, Clock, ClipboardCopy, Info, Link2, Percent, Users } from "lucide-react";
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
import { PANTRY_CATEGORIES } from "@/types/pantry";
import type { MasterIngredientScope } from "@/types/ingredientRef";
import {
  ingredientLinkKey,
  ingredientLineLinkKeys,
  masterScopeFromMasterIngredient,
  resolveMasterIngredient,
} from "@/lib/ingredientRef";
import {
  parseSuggestionIngredientParams,
  type SuggestionsLocationState,
} from "@/lib/suggestionsNavigation";

interface ExtraIngredient {
  name: string;
  nameSecondary: string;
  masterIngredientId: string | null;
  masterIngredientScope: MasterIngredientScope;
}

export function SuggestionsPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { recipes, loading: loadingRecipes } = useRecipes();
  const { tags } = useTags();
  const {
    ingredients: masterIngredients,
    loading: loadingMasters,
    mastersFetched,
  } = useIngredients();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loadingPantry, setLoadingPantry] = useState(true);
  const [extraIngredient, setExtraIngredient] = useState("");
  const [extraIngredients, setExtraIngredients] = useState<ExtraIngredient[]>([]);
  const [pendingExtra, setPendingExtra] = useState<ExtraIngredient>({
    name: "",
    nameSecondary: "",
    masterIngredientId: null,
    masterIngredientScope: null,
  });
  const [copied, setCopied] = useState(false);

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

  /** Dedupe by link key (and freeform name) so dev Strict Mode or repeat adds cannot double-count. */
  const uniqueExtraIngredients = useMemo(() => {
    const seenKeys = new Set<string>();
    const seenFreeform = new Set<string>();
    const out: ExtraIngredient[] = [];
    for (const e of extraIngredients) {
      const k = ingredientLinkKey(e.masterIngredientId, e.masterIngredientScope);
      if (k) {
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
      } else {
        const n = e.name.trim().toLowerCase();
        if (!n || seenFreeform.has(n)) continue;
        seenFreeform.add(n);
      }
      out.push(e);
    }
    return out;
  }, [extraIngredients]);

  const combinedPantry = useMemo<PantryItem[]>(
    () => [
      ...pantryItems,
      ...uniqueExtraIngredients.map((e, i) => ({
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
        masterIngredientScope: e.masterIngredientScope,
        note: "",
        expiresOn: null,
        isOpened: false,
        addedAt: new Date(),
      })),
    ],
    [pantryItems, uniqueExtraIngredients]
  );

  const suggestions = useMemo(
    () => suggestRecipes(recipes, combinedPantry),
    [recipes, combinedPantry]
  );

  const matchedExtrasPerRecipe = useMemo(() => {
    if (uniqueExtraIngredients.length === 0) return new Map<string, string[]>();
    const extraByLinkKey = new Map(
      uniqueExtraIngredients
        .map((e) => {
          const k = ingredientLinkKey(e.masterIngredientId, e.masterIngredientScope);
          return k ? ([k, e.name] as const) : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    );

    const map = new Map<string, string[]>();
    for (const s of suggestions) {
      const hits: string[] = [];
      for (const ing of s.recipe.ingredients) {
        if (ing.isSection) continue;
        if (!s.matchedIngredients.includes(ing.name)) continue;
        for (const lk of ingredientLineLinkKeys(ing)) {
          if (extraByLinkKey.has(lk)) {
            const name = extraByLinkKey.get(lk)!;
            if (!hits.includes(name)) hits.push(name);
          }
        }
      }
      if (hits.length > 0) map.set(s.recipe.id, hits);
    }
    return map;
  }, [uniqueExtraIngredients, suggestions]);

  const unmatchedExtras = useMemo(() => {
    if (uniqueExtraIngredients.length === 0) return [];
    const matchedExtraNames = new Set(
      Array.from(matchedExtrasPerRecipe.values()).flat().map((n) => n.toLowerCase())
    );
    return uniqueExtraIngredients.filter(
      (e) => !matchedExtraNames.has(e.name.toLowerCase())
    );
  }, [uniqueExtraIngredients, matchedExtrasPerRecipe]);

  const noRecipeWithAllExtras = useMemo(() => {
    if (uniqueExtraIngredients.length < 2) return false;
    const linkedCount = uniqueExtraIngredients.filter((e) => e.masterIngredientId).length;
    if (linkedCount < 2) return false;
    for (const hits of matchedExtrasPerRecipe.values()) {
      if (hits.length >= linkedCount) return false;
    }
    return true;
  }, [uniqueExtraIngredients, matchedExtrasPerRecipe]);

  const sortedSuggestions = useMemo(() => {
    if (uniqueExtraIngredients.length === 0) return suggestions;
    const extrasMap = matchedExtrasPerRecipe;
    return [...suggestions].sort((a, b) => {
      const aExtras = extrasMap.get(a.recipe.id)?.length ?? 0;
      const bExtras = extrasMap.get(b.recipe.id)?.length ?? 0;
      if (aExtras !== bExtras) return bExtras - aExtras;
      return b.matchPercentage - a.matchPercentage;
    });
  }, [suggestions, uniqueExtraIngredients.length, matchedExtrasPerRecipe]);

  const pantryLinkKeys = useMemo(
    () =>
      new Set(
        pantryItems
          .map((p) => ingredientLinkKey(p.masterIngredientId, p.masterIngredientScope))
          .filter((k): k is string => k !== null)
      ),
    [pantryItems]
  );

  useEffect(() => {
    const state = location.state as SuggestionsLocationState | undefined;
    const seed = state?.suggestionsSeed;
    const raw = new URLSearchParams(searchParams.toString());
    const fromUrl = parseSuggestionIngredientParams(raw);
    const parsed = seed
      ? { masterId: seed.masterId, scope: seed.scope }
      : fromUrl;
    const forceAsExtra = Boolean(seed?.forceAsExtra);

    if (!parsed) {
      if (raw.get("masterId")) {
        navigate("/suggestions", { replace: true, state: {} });
      }
      return;
    }

    if (loadingPantry || !mastersFetched) return;

    const key = ingredientLinkKey(parsed.masterId, parsed.scope);
    if (!key) {
      navigate("/suggestions", { replace: true, state: {} });
      return;
    }

    if (pantryLinkKeys.has(key) && !forceAsExtra) {
      navigate("/suggestions", { replace: true, state: {} });
      return;
    }

    const mi = resolveMasterIngredient(
      parsed.masterId,
      parsed.scope,
      masterIngredients
    );
    if (!mi) {
      navigate("/suggestions", { replace: true, state: {} });
      return;
    }

    const scope: MasterIngredientScope =
      parsed.scope === "catalog" || parsed.scope === "custom"
        ? parsed.scope
        : masterScopeFromMasterIngredient(mi);

    flushSync(() => {
      setExtraIngredients((prev) => {
        if (
          prev.some(
            (e) => ingredientLinkKey(e.masterIngredientId, e.masterIngredientScope) === key
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            name: mi.name,
            nameSecondary: mi.nameGr ?? "",
            masterIngredientId: parsed.masterId,
            masterIngredientScope: scope,
          },
        ];
      });
    });

    navigate("/suggestions", { replace: true, state: {} });
  }, [
    location.state,
    searchParams,
    loadingPantry,
    mastersFetched,
    pantryLinkKeys,
    masterIngredients,
    navigate,
  ]);

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
        masterIngredientScope: pendingExtra.masterIngredientScope,
      },
    ]);
    setExtraIngredient("");
    setPendingExtra({
      name: "",
      nameSecondary: "",
      masterIngredientId: null,
      masterIngredientScope: null,
    });
  };

  const buildRecipePrompt = useCallback(() => {
    const staples = pantryItems.filter((i) => i.isStaple);
    const regular = pantryItems.filter((i) => !i.isStaple);

    const formatItem = (item: PantryItem) => {
      let s = item.name;
      if (item.quantity != null || item.unit) {
        const parts = [item.quantity?.toString(), item.unit].filter(Boolean).join(" ");
        s += ` (${parts})`;
      }
      return s;
    };

    const byCategory = PANTRY_CATEGORIES.reduce((acc, cat) => {
      const catItems = regular.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    }, {} as Record<string, PantryItem[]>);

    const lines: string[] = [
      "I have the following ingredients in my pantry:",
      "",
    ];

    for (const [cat, catItems] of Object.entries(byCategory)) {
      lines.push(`${cat}: ${catItems.map(formatItem).join(", ")}`);
    }

    if (uniqueExtraIngredients.length > 0) {
      lines.push("");
      lines.push(
        `Extra ingredients I also have: ${uniqueExtraIngredients.map((e) => e.name).join(", ")}`
      );
    }

    if (staples.length > 0) {
      lines.push("");
      lines.push(
        `Staples (always available): ${staples.map(formatItem).join(", ")}`
      );
    }

    lines.push("");
    lines.push("Suggest 1 recipe I can make with these ingredients.");

    return lines.join("\n");
  }, [pantryItems, uniqueExtraIngredients]);

  const handleCopyPrompt = async () => {
    const prompt = buildRecipePrompt();
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loading = loadingRecipes || loadingPantry || loadingMasters;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-stone-800">What Can I Cook?</h1>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-stone-500">
          Based on your pantry ({pantryItems.length} items) and any extra
          ingredients you add below.
        </p>
        {pantryItems.length > 0 && (
          <button
            onClick={handleCopyPrompt}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 transition-colors"
            title="Copy a ChatGPT prompt with all your pantry items"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardCopy size={14} />
                Ask ChatGPT
              </>
            )}
          </button>
        )}
      </div>

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
              setPendingExtra({
                name: v,
                nameSecondary: "",
                masterIngredientId: null,
                masterIngredientScope: null,
              });
            }}
            onSelect={(mi) => {
              setExtraIngredient(mi.name);
              setPendingExtra({
                name: mi.name,
                nameSecondary: mi.nameGr,
                masterIngredientId: mi.id,
                masterIngredientScope: masterScopeFromMasterIngredient(mi),
              });
            }}
          />
          <Button type="submit" variant="secondary" disabled={!pendingExtra.name.trim()}>
            Add
          </Button>
        </div>
      </form>

      {uniqueExtraIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-stone-500 self-center">Extra:</span>
          {uniqueExtraIngredients.map((ing) => {
            const lk = ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope);
            const chipKey = lk ?? `ff:${ing.name.toLowerCase()}`;
            return (
            <span
              key={chipKey}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                (ing.masterIngredientId
                  ? pantryLinkKeys.has(
                      ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope)!
                    )
                  : pantryNames.has(ing.name.toLowerCase()))
                  ? "bg-green-50 text-green-700"
                  : "bg-blue-950/10 text-blue-950"
              }`}
            >
              {ing.masterIngredientId && <Link2 size={12} className="shrink-0" />}
              {ing.name}
              <button
                type="button"
                onClick={() =>
                  setExtraIngredients((prev) =>
                    prev.filter((p) => {
                      const pk = ingredientLinkKey(p.masterIngredientId, p.masterIngredientScope);
                      if (lk && pk) return pk !== lk;
                      if (!lk && !pk)
                        return p.name.trim().toLowerCase() !== ing.name.trim().toLowerCase();
                      return true;
                    })
                  )
                }
                className="ml-0.5 hover:opacity-70"
              >
                x
              </button>
            </span>
            );
          })}
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
                  {uniqueExtraIngredients.map((e) => e.name).join(", ")}
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
      ) : uniqueExtraIngredients.length > 0 ? (
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
