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
  Play,
  Trash2,
  Users,
} from "lucide-react";
import { useRecipe, useRecipeMutations } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { fetchPantryItems } from "@/lib/firestore";
import { Button } from "@/components/ui/Button";
import { TagChip } from "@/components/ui/TagChip";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { PantryItem } from "@/types/pantry";

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, loading, error } = useRecipe(id);
  const { tags } = useTags();
  const { categories } = useCategories();
  const { remove, create, incrementCooked } = useRecipeMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const [cookedCount, setCookedCount] = useState(0);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

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

  const handleMarkCooked = async () => {
    if (!recipe) return;
    setCookedCount((c) => c + 1);
    await incrementCooked(recipe.id);
  };

  const pantryMasterIds = useMemo(
    () => new Set(pantryItems.map((p) => p.masterIngredientId).filter(Boolean)),
    [pantryItems]
  );

  const pantryNames = useMemo(() => {
    const normalize = (s: string) =>
      s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ς/g, "σ").replace(/\s+/g, " ");
    return pantryItems.flatMap((p) => {
      const names = [normalize(p.name)];
      if (p.nameSecondary) names.push(normalize(p.nameSecondary));
      return names;
    });
  }, [pantryItems]);

  const isInPantry = useCallback(
    (name: string, nameSecondary?: string, masterIngredientId?: string | null) => {
      if (masterIngredientId && pantryMasterIds.has(masterIngredientId)) {
        return true;
      }
      const normalize = (s: string) =>
        s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ς/g, "σ").replace(/\s+/g, " ");
      const candidates = [normalize(name)];
      if (nameSecondary?.trim()) candidates.push(normalize(nameSecondary));
      return pantryNames.some((p) =>
        candidates.some((c) => c.includes(p) || p.includes(c))
      );
    },
    [pantryNames, pantryMasterIds]
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
          <Button variant="secondary" size="sm" onClick={handleMarkCooked}>
            <ChefHat size={16} />
            <span className="hidden sm:inline">I made this!</span>
            <span className="inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold min-w-[1.25rem] h-5 px-1">
              {cookedCount}
            </span>
          </Button>
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
        <h1 className="text-3xl font-bold text-stone-900">{recipe.title}</h1>
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
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
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
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
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
                {recipe.ingredients.filter((ing) => isInPantry(ing.name, ing.nameSecondary, ing.masterIngredientId)).length}
                /{recipe.ingredients.length} in pantry
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {recipe.ingredients
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((ing, i) => {
                const inPantry = isInPantry(ing.name, ing.nameSecondary, ing.masterIngredientId);
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
                      inPantry
                        ? "bg-green-50 hover:bg-green-100/70"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm flex-1">
                      {ing.quantity && (
                        <span className="font-medium">{ing.quantity} </span>
                      )}
                      {ing.unit && (
                        <span className="text-stone-500">{ing.unit} </span>
                      )}
                      <span className="text-stone-700">{ing.name}</span>
                      {ing.nameSecondary && (
                        <span className="ml-1.5 italic text-stone-400">
                          ({ing.nameSecondary})
                        </span>
                      )}
                      {ing.masterIngredientId && (
                        <span className="ml-1 inline-flex text-brand-400" title="From catalog">
                          <Link2 size={12} />
                        </span>
                      )}
                      {ing.note && (
                        <span className="ml-1.5 text-stone-400 italic">
                          — {ing.note}
                        </span>
                      )}
                    </span>
                    {inPantry && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                        <Check size={10} />
                        In pantry
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>

        {/* Steps */}
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">Steps</h2>
          <ol className="space-y-6">
            {recipe.steps
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-stone-700 leading-relaxed">
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
              ))}
          </ol>
        </div>
      </div>

      {/* Delete dialog */}
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
