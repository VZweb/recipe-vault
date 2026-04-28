import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  Link2,
  Minus,
  Package,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useRecipe, useRecipeMutations } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { fetchPantryItems } from "@/lib/firestore";
import {
  ingredientLinkKey,
  ingredientLineLinkKeys,
  resolveMasterIngredient,
} from "@/lib/ingredientRef";
import { navigateToSuggestionsForIngredient, recipeLineSuggestionMaster } from "@/lib/suggestionsNavigation";
import { Button } from "@/components/ui/Button";
import { TagChip } from "@/components/ui/TagChip";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CookPantryWizardDialog } from "@/components/CookPantryWizardDialog";
import type { CookCountedReason } from "@/components/CookPantryWizardDialog";
import type { PantryItem } from "@/types/pantry";
import type { Ingredient } from "@/types/recipe";
import { useIngredients } from "@/hooks/useIngredients";

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, loading, error } = useRecipe(id);
  const { tags } = useTags();
  const { categories } = useCategories();
  const { ingredients: masterIngredients } = useIngredients();
  const { remove, create, incrementCooked, decrementCooked } = useRecipeMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const [cookedCount, setCookedCount] = useState(0);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [cookWizardOpen, setCookWizardOpen] = useState(false);

  const loadPantry = useCallback(async () => {
    const items = await fetchPantryItems();
    setPantryItems(items);
  }, []);

  useEffect(() => {
    void loadPantry();
  }, [loadPantry]);

  useEffect(() => {
    if (recipe) setCookedCount(recipe.cookedCount);
  }, [recipe]);

  const handleCountedCook = async (_reason: CookCountedReason) => {
    if (!recipe) return;
    setCookedCount((c) => c + 1);
    await incrementCooked(recipe.id);
    await loadPantry();
  };

  const handleDecrementCookQuick = async () => {
    if (!recipe || cookedCount <= 0) return;
    const prev = cookedCount;
    setCookedCount((c) => Math.max(0, c - 1));
    try {
      await decrementCooked(recipe.id);
    } catch {
      setCookedCount(prev);
    }
  };

  const pantryLinkKeys = useMemo(
    () =>
      new Set(
        pantryItems
          .map((p) => ingredientLinkKey(p.masterIngredientId, p.masterIngredientScope))
          .filter((k): k is string => k !== null)
      ),
    [pantryItems]
  );

  const isInPantry = useCallback(
    (ing: Pick<Ingredient, "masterIngredientId" | "masterIngredientScope" | "substituteLinks">) =>
      ingredientLineLinkKeys(ing).some((k) => pantryLinkKeys.has(k)),
    [pantryLinkKeys]
  );

  const pantryMatchKind = useCallback(
    (ing: Pick<Ingredient, "masterIngredientId" | "masterIngredientScope" | "substituteLinks">) => {
      const keys = ingredientLineLinkKeys(ing);
      if (!keys.some((k) => pantryLinkKeys.has(k))) return "none" as const;
      const primary = ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope);
      if (primary && pantryLinkKeys.has(primary)) return "primary" as const;
      return "substitute" as const;
    },
    [pantryLinkKeys]
  );

  const matchedSubstituteName = useCallback(
    (ing: Pick<Ingredient, "substituteLinks">) => {
      for (const sub of ing.substituteLinks ?? []) {
        const k = ingredientLinkKey(sub.masterIngredientId, sub.masterIngredientScope);
        if (!k || !pantryLinkKeys.has(k)) continue;
        const mi = resolveMasterIngredient(
          sub.masterIngredientId,
          sub.masterIngredientScope,
          masterIngredients
        );
        return mi?.name ?? null;
      }
      return null;
    },
    [pantryLinkKeys, masterIngredients]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-500">Recipe not found.</p>
        <Link to="/recipes" className="mt-4 inline-block">
          <Button variant="secondary">Back to Recipes</Button>
        </Link>
      </div>
    );
  }

  const recipeTags = tags.filter((t) => recipe.tags.includes(t.id));
  const recipeCategory = categories.find((c) => c.id === recipe.categoryId);
  const totalTime =
    (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0) || null;

  const handleDelete = async () => {
    await remove(recipe.id);
    navigate("/recipes");
  };

  const handleDuplicate = async () => {
    const newId = await create({
      title: `${recipe.title} (copy)`,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      sourceUrl: recipe.sourceUrl,
      videoUrl: recipe.videoUrl,
      imageUrls: recipe.imageUrls,
      categoryId: recipe.categoryId,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      notes: recipe.notes,
    });
    navigate(`/recipes/${newId}`);
  };

  return (
    <div className="space-y-8">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/recipes"
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to recipes
        </Link>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => void handleDecrementCookQuick()}
              disabled={cookedCount <= 0}
              className="flex items-center justify-center px-2 py-1.5 text-stone-600 hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Decrease times cooked"
            >
              <Minus size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setCookWizardOpen(true)}
              className="flex items-center gap-1.5 border-x border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-brand-50/80 transition-colors"
            >
              <ChefHat size={16} className="text-brand-600 shrink-0" />
              <span className="hidden sm:inline">I made this!</span>
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-100 px-1 h-5 text-xs font-semibold text-brand-700 tabular-nums">
                {cookedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCookWizardOpen(true)}
              className="flex items-center justify-center px-2 py-1.5 text-stone-600 hover:bg-stone-50"
              aria-label="Log a cook and update pantry"
            >
              <Plus size={16} strokeWidth={2.25} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDuplicate}>
            <Copy size={16} />
            <span className="hidden sm:inline">Duplicate</span>
          </Button>
          <Link to={`/recipes/${recipe.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit size={16} />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="!text-red-500 hover:!bg-red-50"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Hero Image */}
      {recipe.imageUrls.length > 0 && (
        <div className="space-y-2">
          <div className="aspect-[16/9] overflow-hidden rounded-xl bg-stone-100">
            <img
              src={recipe.imageUrls[imageIdx]}
              alt={recipe.title}
              className="h-full w-full object-cover"
            />
          </div>
          {recipe.imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recipe.imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setImageIdx(i)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    i === imageIdx
                      ? "border-brand-500"
                      : "border-transparent hover:border-stone-300"
                  }`}
                >
                  <img
                    src={url}
                    alt={`${recipe.title} ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Title + Meta */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-stone-900">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-2 text-stone-600">{recipe.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-500">
          {recipe.prepTimeMin && (
            <span className="flex items-center gap-1.5">
              <Clock size={16} />
              Prep: {recipe.prepTimeMin} min
            </span>
          )}
          {recipe.cookTimeMin && (
            <span className="flex items-center gap-1.5">
              <Clock size={16} />
              Cook: {recipe.cookTimeMin} min
            </span>
          )}
          {totalTime && (
            <span className="font-medium text-stone-700">
              Total: {totalTime} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1.5">
              <Users size={16} />
              {recipe.servings} servings
            </span>
          )}
          <span className="flex items-center gap-1.5 font-medium text-brand-600">
            <ChefHat size={16} />
            Cooked {cookedCount} {cookedCount === 1 ? "time" : "times"}
          </span>
        </div>

        {(recipeCategory || recipeTags.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {recipeCategory && (
              <Link
                to={`/recipes?category=${recipeCategory.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors"
              >
                <CategoryIcon icon={recipeCategory.icon} size={14} />
                {recipeCategory.name}
              </Link>
            )}
            {recipeTags.map((tag) => (
              <Link key={tag.id} to={`/recipes?tag=${tag.id}`}>
                <TagChip name={tag.name} color={tag.color} />
              </Link>
            ))}
          </div>
        )}

        {(recipe.sourceUrl || recipe.videoUrl) && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <ExternalLink size={14} />
                View original source
              </a>
            )}
            {recipe.videoUrl && (
              <a
                href={recipe.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <Play size={14} />
                Watch video
              </a>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      {recipe.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="text-lg font-semibold text-stone-800 mb-2">Notes</h2>
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
            {recipe.notes}
          </p>
        </div>
      )}

      {/* Ingredients + Steps */}
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-800">
              Ingredients
            </h2>
            {pantryItems.length > 0 && (
              <span className="text-xs text-stone-400">
                {recipe.ingredients.filter((ing) => !ing.isSection && isInPantry(ing)).length}
                /{recipe.ingredients.filter((ing) => !ing.isSection).length} in pantry
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {recipe.ingredients
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((ing, i) => {
                if (ing.isSection) {
                  return (
                    <li key={i} className="pt-4 first:pt-0 pb-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        {ing.name}
                      </h4>
                    </li>
                  );
                }
                const inPantry = isInPantry(ing);
                const matchKind = pantryMatchKind(ing);
                const subPantryName = matchKind === "substitute" ? matchedSubstituteName(ing) : null;
                const suggestionTarget = recipeLineSuggestionMaster(ing);
                const checked = checkedIngredients.has(i);
                const toggleChecked = () =>
                  setCheckedIngredients((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                return (
                  <li
                    key={i}
                    onClick={toggleChecked}
                    className={`flex items-start gap-2.5 rounded-lg px-2 py-2 cursor-pointer select-none transition-colors sm:gap-2.5 ${
                      checked ? "opacity-50" : ""
                    } ${
                      inPantry
                        ? "bg-green-50 hover:bg-green-100/70"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500 pointer-events-none"
                    />
                    <span
                      className="inline-flex w-[4.5rem] flex-shrink-0 items-baseline gap-1 overflow-hidden pt-0.5 text-ellipsis whitespace-nowrap"
                      title={
                        [ing.quantity != null ? String(ing.quantity) : "", ing.unit || ""]
                          .join(" ")
                          .trim() || undefined
                      }
                    >
                      {ing.quantity != null && (
                        <span className="text-sm font-bold tabular-nums text-stone-900">
                          {ing.quantity}
                        </span>
                      )}
                      {ing.unit ? (
                        <span className="min-w-0 truncate text-[11px] text-stone-500">
                          {ing.unit}
                        </span>
                      ) : null}
                      {ing.quantity == null && !ing.unit ? (
                        <span className="block min-h-[1.25em] w-full" aria-hidden />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span
                          className={`min-w-0 max-w-full text-sm font-medium break-words [overflow-wrap:anywhere] ${checked ? "line-through text-stone-400" : "text-stone-800"}`}
                        >
                          {ing.name}
                        </span>
                        {ing.masterIngredientId && (
                          <span className="inline-flex shrink-0 text-brand-400" title="From catalog">
                            <Link2 size={12} />
                          </span>
                        )}
                        {ing.nameSecondary && (
                          <span className="min-w-0 max-w-full break-words text-sm italic text-stone-400 [overflow-wrap:anywhere]">
                            ({ing.nameSecondary})
                          </span>
                        )}
                      </div>
                      {ing.substituteLinks && ing.substituteLinks.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                            or
                          </span>
                          {ing.substituteLinks.map((sub, si) => {
                            const mi = resolveMasterIngredient(
                              sub.masterIngredientId,
                              sub.masterIngredientScope,
                              masterIngredients
                            );
                            return (
                              <span
                                key={`${sub.masterIngredientId}-${si}`}
                                className="inline-flex max-w-full items-center gap-0.5 rounded-md border border-stone-200/80 bg-stone-50 px-1.5 py-0.5 text-xs text-stone-600 [overflow-wrap:anywhere]"
                                title="Alternative for pantry matching"
                              >
                                <Link2 size={10} className="shrink-0 text-brand-400" aria-hidden />
                                <span className="min-w-0 break-words">
                                  {mi?.name ?? sub.masterIngredientId}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {ing.note && (
                        <p className="mt-0.5 text-xs text-stone-400 italic leading-snug break-words [overflow-wrap:anywhere]">
                          {ing.note}
                        </p>
                      )}
                    </div>
                    <span className="mt-0.5 flex flex-shrink-0 items-start gap-0.5">
                      {inPantry && (
                        <span
                          className="text-green-600"
                          title={
                            matchKind === "substitute" && subPantryName
                              ? `In pantry (matched alternative: ${subPantryName})`
                              : "In pantry"
                          }
                        >
                          <Package size={16} />
                        </span>
                      )}
                      {suggestionTarget && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToSuggestionsForIngredient(
                              navigate,
                              suggestionTarget.masterId,
                              suggestionTarget.scope,
                              { forceAsExtra: true }
                            );
                          }}
                          className="rounded-md p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-amber-600"
                          title="Recipe suggestions"
                          aria-label="Recipe suggestions with this ingredient"
                        >
                          <Sparkles size={16} />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-800">Steps</h2>
            {checkedSteps.size > 0 && (
              <span className="text-xs text-stone-400">
                {checkedSteps.size}/{recipe.steps.length} done
              </span>
            )}
          </div>
          <ol className="space-y-6">
            {recipe.steps
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((step, i) => {
                const done = checkedSteps.has(i);
                return (
                  <li
                    key={i}
                    className={`flex gap-4 cursor-pointer group transition-opacity ${
                      done ? "opacity-50" : ""
                    }`}
                    onClick={() =>
                      setCheckedSteps((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                        done
                          ? "bg-green-100 text-green-700"
                          : "bg-brand-100 text-brand-700 group-hover:bg-brand-200"
                      }`}
                    >
                      {done ? <Check size={14} /> : i + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <p
                        className={`text-sm leading-relaxed transition-colors ${
                          done
                            ? "line-through text-stone-400"
                            : "text-stone-700"
                        }`}
                      >
                        {step.instruction}
                      </p>
                      {step.imageUrl && (
                        <img
                          src={step.imageUrl}
                          alt={`Step ${i + 1}`}
                          className="mt-2 max-h-48 rounded-lg object-cover"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        </div>
      </div>

      {/* Delete dialog */}
      <CookPantryWizardDialog
        recipe={recipe}
        pantryItems={pantryItems}
        masterIngredients={masterIngredients}
        open={cookWizardOpen}
        onOpenChange={setCookWizardOpen}
        onCountedCook={handleCountedCook}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete recipe"
        message={`Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
