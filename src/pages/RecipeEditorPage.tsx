import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, ClipboardPaste, ImagePlus, LayoutList, Link, Link2, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { parseIngredientText } from "@/lib/parseIngredients";
import { parseStepsText } from "@/lib/parseSteps";
import { useRecipe, useRecipeMutations } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useIngredients } from "@/hooks/useIngredients";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TagChip } from "@/components/ui/TagChip";
import { Spinner } from "@/components/ui/Spinner";
import { IngredientAutocomplete } from "@/components/ui/IngredientAutocomplete";
import { IngredientQuickAdd } from "@/components/ui/IngredientQuickAdd";
import { TAG_CATEGORIES } from "@/types/tag";
import type { Ingredient, Step, RecipeFormData } from "@/types/recipe";
import {
  ingredientLinkKey,
  ingredientLineLinkKeys,
  masterScopeFromMasterIngredient,
  resolveMasterIngredient,
} from "@/lib/ingredientRef";

function emptyIngredient(sortOrder: number): Ingredient {
  return {
    name: "",
    nameSecondary: "",
    quantity: null,
    unit: "",
    sortOrder,
    masterIngredientId: null,
    masterIngredientScope: null,
    substituteLinks: [],
    note: "",
    isSection: false,
  };
}

function emptySection(sortOrder: number): Ingredient {
  return {
    name: "",
    nameSecondary: "",
    quantity: null,
    unit: "",
    sortOrder,
    masterIngredientId: null,
    masterIngredientScope: null,
    substituteLinks: [],
    note: "",
    isSection: true,
  };
}

function emptyStep(sortOrder: number): Step {
  return { instruction: "", imageUrl: null, sortOrder };
}

const defaultForm: RecipeFormData = {
  title: "",
  description: "",
  servings: null,
  prepTimeMin: null,
  cookTimeMin: null,
  sourceUrl: "",
  videoUrl: "",
  imageUrls: [],
  categoryId: null,
  tags: [],
  ingredients: [emptyIngredient(0)],
  steps: [emptyStep(0)],
  notes: "",
};

export function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { recipe, loading: loadingRecipe } = useRecipe(id);
  const { tags } = useTags();
  const { categories } = useCategories();
  const { create, update } = useRecipeMutations();
  const { upload, uploading } = useImageUpload();
  const { ingredients: masterIngredients, add: addCatalogIngredient } = useIngredients();

  const [form, setForm] = useState<RecipeFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [noteOpenSet, setNoteOpenSet] = useState<Set<number>>(new Set());
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [stepsPasteOpen, setStepsPasteOpen] = useState(false);
  const [stepsPasteText, setStepsPasteText] = useState("");
  const [quickAddIdx, setQuickAddIdx] = useState<number | null>(null);
  const [pasteReview, setPasteReview] = useState<Ingredient[] | null>(null);
  const [pasteReviewQuickAddIdx, setPasteReviewQuickAddIdx] = useState<number | null>(null);
  const [substitutePickerIdx, setSubstitutePickerIdx] = useState<number | null>(null);
  const [substitutePickerQuery, setSubstitutePickerQuery] = useState("");
  const [activeTagCategory, setActiveTagCategory] = useState<string | null>(null);

  useEffect(() => {
    if (substitutePickerIdx === null) setSubstitutePickerQuery("");
  }, [substitutePickerIdx]);

  useEffect(() => {
    if (recipe && isEditing) {
      setForm({
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMin: recipe.prepTimeMin,
        cookTimeMin: recipe.cookTimeMin,
        sourceUrl: recipe.sourceUrl,
        videoUrl: recipe.videoUrl,
        imageUrls: recipe.imageUrls,
        categoryId: recipe.categoryId,
        tags: recipe.tags,
        ingredients:
          recipe.ingredients.length > 0
            ? recipe.ingredients
            : [emptyIngredient(0)],
        steps: recipe.steps.length > 0 ? recipe.steps : [emptyStep(0)],
        notes: recipe.notes,
      });
      setPreviewImages(recipe.imageUrls);
      const ings = recipe.ingredients.length > 0 ? recipe.ingredients : [];
      const openNotes = new Set<number>();
      ings.forEach((ing, i) => { if (ing.note) openNotes.add(i); });
      setNoteOpenSet(openNotes);
    }
  }, [recipe, isEditing]);

  const setField = <K extends keyof RecipeFormData>(
    key: K,
    value: RecipeFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  // --- Ingredients ---

  const updateIngredient = (idx: number, patch: Partial<Ingredient>) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === idx ? { ...ing, ...patch } : ing
      ),
    }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        emptyIngredient(prev.ingredients.length),
      ],
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        emptySection(prev.ingredients.length),
      ],
    }));
  };

  const unlinkedCount = useMemo(
    () =>
      form.ingredients.filter(
        (i) => !i.isSection && i.name.trim() && ingredientLineLinkKeys(i).length === 0
      ).length,
    [form.ingredients]
  );

  const handlePasteIngredients = () => {
    if (!pasteText.trim()) return;
    const parsed = parseIngredientText(
      pasteText,
      masterIngredients,
      form.ingredients.length,
    );
    if (parsed.length === 0) return;

    const unmatched = parsed.filter((i) => !i.isSection && !i.masterIngredientId);
    if (unmatched.length > 0) {
      setPasteReview(parsed);
      setPasteReviewQuickAddIdx(null);
      return;
    }

    applyParsedIngredients(parsed);
  };

  const applyParsedIngredients = (parsed: Ingredient[]) => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, ...parsed].map((ing, i) => ({
        ...ing,
        sortOrder: i,
      })),
    }));
    const newNotes = new Set(noteOpenSet);
    parsed.forEach((ing, i) => {
      if (ing.note) newNotes.add(form.ingredients.length + i);
    });
    setNoteOpenSet(newNotes);
    setPasteText("");
    setPasteOpen(false);
    setPasteReview(null);
    setPasteReviewQuickAddIdx(null);
  };

  const removeIngredient = (idx: number) => {
    setSubstitutePickerIdx(null);
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients
        .filter((_, i) => i !== idx)
        .map((ing, i) => ({ ...ing, sortOrder: i })),
    }));
  };

  const moveIngredient = (idx: number, direction: -1 | 1) => {
    setSubstitutePickerIdx(null);
    setForm((prev) => {
      const arr = [...prev.ingredients];
      const target = idx + direction;
      if (target < 0 || target >= arr.length) return prev;
      const tmp = arr[idx]!;
      arr[idx] = arr[target]!;
      arr[target] = tmp;
      return {
        ...prev,
        ingredients: arr.map((ing, i) => ({ ...ing, sortOrder: i })),
      };
    });
    setNoteOpenSet((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i === idx) next.add(idx + direction);
        else if (i === idx + direction) next.add(idx);
        else next.add(i);
      }
      return next;
    });
  };

  // --- Steps ---

  const updateStep = (idx: number, patch: Partial<Step>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, emptyStep(prev.steps.length)],
    }));
  };

  const removeStep = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, sortOrder: i })),
    }));
  };

  const handlePasteSteps = () => {
    if (!stepsPasteText.trim()) return;
    const parsed = parseStepsText(stepsPasteText, form.steps.length);
    if (parsed.length === 0) return;
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, ...parsed].map((s, i) => ({
        ...s,
        sortOrder: i,
      })),
    }));
    setStepsPasteText("");
    setStepsPasteOpen(false);
  };

  // --- Tags ---

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((t) => t !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  // --- Images ---

  const handleImageSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newUrls: string[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      newPreviews.push(URL.createObjectURL(file));
      const url = await upload(file);
      newUrls.push(url);
    }

    setPreviewImages((prev) => [...prev, ...newPreviews]);
    setField("imageUrls", [...form.imageUrls, ...newUrls]);
  };

  const removeImage = (idx: number) => {
    setPreviewImages((prev) => prev.filter((_, i) => i !== idx));
    setField(
      "imageUrls",
      form.imageUrls.filter((_, i) => i !== idx)
    );
  };

  const addImageByUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setPreviewImages((prev) => [...prev, url]);
    setField("imageUrls", [...form.imageUrls, url]);
    setImageUrlInput("");
    setShowImageUrlInput(false);
  };

  // --- Submit ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || saving) return;

    setSaving(true);
    try {
      const cleanedIngredients = form.ingredients.filter(
        (i) => i.name.trim() !== ""
      );
      const cleanedSteps = form.steps.filter(
        (s) => s.instruction.trim() !== ""
      );
      const data = {
        ...form,
        ingredients: cleanedIngredients,
        steps: cleanedSteps,
      };

      if (isEditing && id) {
        await update(id, data);
        navigate(`/recipes/${id}`);
      } else {
        const newId = await create(data);
        navigate(`/recipes/${newId}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && loadingRecipe) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="font-heading text-xl font-bold text-stone-800">
          {isEditing ? "Edit Recipe" : "New Recipe"}
        </h1>
        <Button type="submit" disabled={saving || !form.title.trim()}>
          {saving ? <Spinner /> : isEditing ? "Save" : "Create"}
        </Button>
      </div>

      {/* Basic info */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <Input
          label="Title"
          placeholder="e.g., Greek Lemon Chicken"
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          required
        />
        <Textarea
          label="Description"
          placeholder="A brief description of the recipe..."
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Servings"
            type="number"
            min={1}
            placeholder="4"
            value={form.servings ?? ""}
            onChange={(e) =>
              setField("servings", e.target.value ? Number(e.target.value) : null)
            }
          />
          <Input
            label="Prep (min)"
            type="number"
            min={0}
            placeholder="15"
            value={form.prepTimeMin ?? ""}
            onChange={(e) =>
              setField(
                "prepTimeMin",
                e.target.value ? Number(e.target.value) : null
              )
            }
          />
          <Input
            label="Cook (min)"
            type="number"
            min={0}
            placeholder="45"
            value={form.cookTimeMin ?? ""}
            onChange={(e) =>
              setField(
                "cookTimeMin",
                e.target.value ? Number(e.target.value) : null
              )
            }
          />
          <Input
            label="Source URL"
            type="url"
            placeholder="https://..."
            value={form.sourceUrl}
            onChange={(e) => setField("sourceUrl", e.target.value)}
          />
        </div>
        <Input
          label="Video URL"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={form.videoUrl}
          onChange={(e) => setField("videoUrl", e.target.value)}
        />
      </section>

      {/* Images */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Photos</h2>
        <div className="flex flex-wrap gap-3">
          {previewImages.map((url, i) => (
            <div key={i} className="group relative h-24 w-24 rounded-lg overflow-hidden">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-stone-400 hover:border-brand-400 hover:text-brand-500 transition-colors">
            {uploading ? (
              <Spinner />
            ) : (
              <>
                <ImagePlus size={20} />
                <span className="mt-1 text-[10px]">Upload</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageSelect(e.target.files)}
              disabled={uploading}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowImageUrlInput((v) => !v)}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-stone-400 hover:border-brand-400 hover:text-brand-500 transition-colors"
          >
            <Link size={20} />
            <span className="mt-1 text-[10px]">URL</span>
          </button>
        </div>
        {showImageUrlInput && (
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Paste image URL (https://...)"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addImageByUrl();
                }
              }}
              className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={addImageByUrl}
              disabled={!imageUrlInput.trim()}
            >
              Add
            </Button>
          </div>
        )}
      </section>

      {/* Category */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Category</h2>
        {categories.length > 0 ? (
          <div className="flex items-center gap-3">
            <select
              value={form.categoryId ?? ""}
              onChange={(e) =>
                setField("categoryId", e.target.value || null)
              }
              className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {form.categoryId && (
              <button
                type="button"
                onClick={() => setField("categoryId", null)}
                className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="Clear category"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            No categories yet.{" "}
            <a href="/categories" className="text-brand-600 hover:underline">
              Create some
            </a>{" "}
            first.
          </p>
        )}
      </section>

      {/* Tags */}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Tags</h2>

        {tags.length > 0 ? (
          <>
            {/* Selected tags */}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <TagChip
                      key={id}
                      name={tag.name}
                      color={tag.color}
                      selected
                      onRemove={() => toggleTag(id)}
                    />
                  );
                })}
              </div>
            )}

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {TAG_CATEGORIES.map((cat) => {
                const catTags = tags.filter((t) => t.category === cat);
                if (catTags.length === 0) return null;
                const isActive = activeTagCategory === cat;
                const selectedCount = catTags.filter((t) =>
                  form.tags.includes(t.id)
                ).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setActiveTagCategory(isActive ? null : cat)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {cat}
                    {selectedCount > 0 && (
                      <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tags for active category */}
            {activeTagCategory && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3">
                {tags
                  .filter((t) => t.category === activeTagCategory)
                  .map((tag) => (
                    <TagChip
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      selected={form.tags.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                    />
                  ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-500">
            No tags yet.{" "}
            <a href="/tags" className="text-brand-600 hover:underline">
              Create some
            </a>{" "}
            first.
          </p>
        )}
      </section>

      {/* Ingredients */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Ingredients</h2>
        <div className="space-y-2">
          {form.ingredients.map((ing, idx) =>
            ing.isSection ? (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3 pt-3 sm:flex-row sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col flex-shrink-0">
                    <button type="button" onClick={() => moveIngredient(idx, -1)} disabled={idx === 0} className="p-0.5 text-stone-400 hover:text-stone-600 disabled:opacity-25 disabled:cursor-default transition-colors"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => moveIngredient(idx, 1)} disabled={idx === form.ingredients.length - 1} className="p-0.5 text-stone-400 hover:text-stone-600 disabled:opacity-25 disabled:cursor-default transition-colors"><ChevronDown size={14} /></button>
                  </div>
                  <LayoutList size={14} className="text-stone-400 flex-shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400 sm:hidden">
                    Section
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Section name (e.g. For the sauce)"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 placeholder:font-normal placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:bg-stone-50 sm:py-1.5"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="self-end p-1.5 text-stone-400 hover:text-red-500 transition-colors sm:self-center"
                  aria-label="Remove section"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div key={idx} className="space-y-2">
              <div
                className="
                  max-sm:grid max-sm:grid-cols-2
                  max-sm:gap-x-2 max-sm:gap-y-2 max-sm:items-start
                  max-sm:rounded-xl max-sm:border max-sm:border-stone-200 max-sm:bg-white max-sm:p-3 max-sm:shadow-sm
                  sm:flex sm:flex-col sm:gap-3 sm:rounded-xl sm:border sm:border-stone-200 sm:bg-stone-50/50 sm:p-3 sm:shadow-sm
                "
              >
                <div className="max-sm:contents sm:flex sm:w-full sm:flex-row sm:items-end sm:gap-x-0.5 sm:gap-y-0">
                <div className="max-sm:contents sm:flex sm:shrink-0 sm:items-end sm:gap-x-1">
                <input
                  type="number"
                  placeholder="Qty"
                  min={0}
                  step="any"
                  value={ing.quantity ?? ""}
                  onChange={(e) =>
                    updateIngredient(idx, {
                      quantity: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="
                    max-sm:col-start-1 max-sm:row-start-2 max-sm:min-w-0
                    w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                    sm:w-[4.5rem] sm:shrink-0 sm:px-2 sm:py-2
                  "
                  inputMode="decimal"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                  className="
                    max-sm:col-start-2 max-sm:row-start-2 max-sm:min-w-0
                    w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                    sm:w-[5.5rem] sm:shrink-0 sm:px-2 sm:py-2
                  "
                />
                </div>
                <div
                  className="
                    max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-1 max-sm:min-w-0
                    min-w-0 w-full sm:flex-1 sm:min-w-0
                  "
                >
                  <IngredientAutocomplete
                    ingredients={masterIngredients}
                    value={ing.name}
                    placeholder="Ingredient name"
                    wrapperClassName="w-full"
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:min-h-[2.5rem] sm:px-3 sm:py-2 ${
                      ing.masterIngredientId
                        ? "border-brand-300 bg-brand-50/30"
                        : "border-stone-300"
                    }`}
                    onChange={(v) => {
                      updateIngredient(idx, {
                        name: v,
                        masterIngredientId: null,
                        masterIngredientScope: null,
                      });
                      if (quickAddIdx === idx) setQuickAddIdx(null);
                    }}
                    onSelect={(mi) => {
                      const pk = ingredientLinkKey(
                        mi.id,
                        masterScopeFromMasterIngredient(mi)
                      );
                      const nextSubs = (ing.substituteLinks ?? []).filter(
                        (s) =>
                          ingredientLinkKey(
                            s.masterIngredientId,
                            s.masterIngredientScope
                          ) !== pk
                      );
                      updateIngredient(idx, {
                        name: mi.name,
                        nameSecondary: mi.nameGr,
                        masterIngredientId: mi.id,
                        masterIngredientScope: masterScopeFromMasterIngredient(mi),
                        substituteLinks: nextSubs,
                      });
                      if (quickAddIdx === idx) setQuickAddIdx(null);
                    }}
                    onCreateNew={() => setQuickAddIdx(idx)}
                  />
                </div>
                </div>
                {noteOpenSet.has(idx) && (
                  <div
                    className="
                      flex max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-3
                      w-full min-w-0 items-stretch gap-2
                      sm:w-full sm:items-center
                    "
                  >
                    <input
                      type="text"
                      placeholder="Note (e.g. diced, melted)"
                      value={ing.note}
                      onChange={(e) => updateIngredient(idx, { note: e.target.value })}
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:min-w-0 sm:flex-1 sm:px-3 sm:py-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateIngredient(idx, { note: "" });
                        setNoteOpenSet((prev) => { const next = new Set(prev); next.delete(idx); return next; });
                      }}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center self-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors sm:h-auto sm:w-auto sm:self-auto"
                      title="Remove note"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div
                  className={[
                    "flex w-full max-w-full flex-col gap-2 max-sm:col-span-2 max-sm:border-t max-sm:border-stone-100 max-sm:pt-2",
                    noteOpenSet.has(idx) ? "max-sm:row-start-4" : "max-sm:row-start-3",
                    "sm:border-t sm:border-stone-200 sm:pt-2",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {(ing.substituteLinks ?? []).map((sub, si) => {
                      const sm = resolveMasterIngredient(
                        sub.masterIngredientId,
                        sub.masterIngredientScope,
                        masterIngredients
                      );
                      return (
                        <span
                          key={`${sub.masterIngredientId}-${si}`}
                          className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700"
                        >
                          <Link2 size={10} className="shrink-0 text-brand-400" />
                          <span>{sm?.name ?? sub.masterIngredientId}</span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-stone-400 hover:text-red-500"
                            aria-label="Remove alternative"
                            onClick={() =>
                              updateIngredient(idx, {
                                substituteLinks: (ing.substituteLinks ?? []).filter(
                                  (_, j) => j !== si
                                ),
                              })
                            }
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {substitutePickerIdx === idx ? (
                      <div className="min-w-0 flex-1 basis-full sm:basis-[min(100%,24rem)]">
                        <IngredientAutocomplete
                          ingredients={masterIngredients}
                          value={substitutePickerQuery}
                          placeholder="Type to pick alternative…"
                          wrapperClassName="w-full"
                          className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          onChange={setSubstitutePickerQuery}
                          onSelect={(mi) => {
                            const pk = ingredientLinkKey(
                              ing.masterIngredientId,
                              ing.masterIngredientScope
                            );
                            const sk = ingredientLinkKey(
                              mi.id,
                              masterScopeFromMasterIngredient(mi)
                            );
                            if (pk && sk && pk === sk) {
                              setSubstitutePickerIdx(null);
                              return;
                            }
                            if (
                              (ing.substituteLinks ?? []).some(
                                (s) =>
                                  ingredientLinkKey(
                                    s.masterIngredientId,
                                    s.masterIngredientScope
                                  ) === sk
                              )
                            ) {
                              setSubstitutePickerIdx(null);
                              return;
                            }
                            updateIngredient(idx, {
                              substituteLinks: [
                                ...(ing.substituteLinks ?? []),
                                {
                                  masterIngredientId: mi.id,
                                  masterIngredientScope:
                                    masterScopeFromMasterIngredient(mi),
                                },
                              ],
                            });
                            setSubstitutePickerIdx(null);
                          }}
                        />
                        <button
                          type="button"
                          className="mt-1 text-xs text-stone-500 hover:text-stone-700"
                          onClick={() => setSubstitutePickerIdx(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSubstitutePickerIdx(idx);
                          setSubstitutePickerQuery("");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 bg-white/80 px-2 py-1 text-xs font-medium text-stone-600 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-800"
                      >
                        <Plus size={12} />
                        Add alternative
                      </button>
                    )}
                  </div>
                  <div className="flex w-full flex-shrink-0 items-center justify-between gap-2">
                  <div className="flex flex-row items-center gap-0.5" aria-label="Reorder ingredient">
                    <button
                      type="button"
                      onClick={() => moveIngredient(idx, -1)}
                      disabled={idx === 0}
                      className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-25 disabled:cursor-default transition-colors"
                      title="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIngredient(idx, 1)}
                      disabled={idx === form.ingredients.length - 1}
                      className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-25 disabled:cursor-default transition-colors"
                      title="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    {ingredientLineLinkKeys(ing).length > 0 ? (
                      <span title="Linked to catalog (primary or alternative)" className="inline-flex p-1.5 text-brand-500">
                        <Link2 size={14} />
                      </span>
                    ) : (
                      ing.name.trim() && (
                        <span title="Not linked — link the ingredient or add an alternative for suggestions" className="inline-flex p-1.5 text-amber-400">
                          <AlertTriangle size={14} />
                        </span>
                      )
                    )}
                    {!noteOpenSet.has(idx) && (
                      <button
                        type="button"
                        onClick={() => setNoteOpenSet((prev) => new Set(prev).add(idx))}
                        className={`rounded-md p-1.5 transition-colors ${
                          ing.note ? "text-brand-500" : "text-stone-400 hover:bg-stone-100 hover:text-stone-600 sm:text-stone-300 sm:hover:bg-transparent sm:hover:text-stone-500"
                        }`}
                        title="Add note"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      disabled={form.ingredients.length <= 1}
                      className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-2 text-stone-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Remove ingredient"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  </div>
                </div>
              </div>
              {quickAddIdx === idx && (
                <IngredientQuickAdd
                  initialName={ing.name}
                  ingredients={masterIngredients}
                  onCreate={addCatalogIngredient}
                  onCreated={(mi) => {
                    const pk = ingredientLinkKey(
                      mi.id,
                      masterScopeFromMasterIngredient(mi)
                    );
                    const nextSubs = (ing.substituteLinks ?? []).filter(
                      (s) =>
                        ingredientLinkKey(
                          s.masterIngredientId,
                          s.masterIngredientScope
                        ) !== pk
                    );
                    updateIngredient(idx, {
                      name: mi.name,
                      nameSecondary: mi.nameGr,
                      masterIngredientId: mi.id,
                      masterIngredientScope: masterScopeFromMasterIngredient(mi),
                      substituteLinks: nextSubs,
                    });
                    setQuickAddIdx(null);
                  }}
                  onCancel={() => setQuickAddIdx(null)}
                />
              )}
              </div>
            )
          )}
        </div>
        {unlinkedCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <p>
              <span className="font-semibold">{unlinkedCount}</span> ingredient{unlinkedCount > 1 ? "s" : ""} with no catalog link on the line (neither primary nor alternative).
              {" "}Those lines won't appear in suggestions. Pick from the dropdown or add alternatives.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={addIngredient}>
            <Plus size={16} />
            Add Ingredient
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addSection}>
            <LayoutList size={16} />
            Add Section
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPasteOpen((v) => !v)}>
            <ClipboardPaste size={16} />
            Paste List
          </Button>
        </div>
        {pasteOpen && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
            <textarea
              rows={8}
              placeholder={"Paste ingredients here, one per line…\n\nExample:\n2 cups flour\n1 tsp salt\n3 eggs\n\nFor the sauce:\n200g tomato paste"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-mono placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handlePasteIngredients} disabled={!pasteText.trim()}>
                Parse & Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPasteOpen(false); setPasteText(""); }}>
                Cancel
              </Button>
              <span className="text-xs text-stone-400 ml-auto">
                Quantities, units & catalog matches are detected automatically
              </span>
            </div>
          </div>
        )}

        {/* Paste review: resolve unmatched ingredients */}
        {pasteReview && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {pasteReview.filter((i) => !i.isSection && !i.masterIngredientId).length} ingredient{pasteReview.filter((i) => !i.isSection && !i.masterIngredientId).length > 1 ? "s" : ""} not found in catalog
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can create catalog entries now, add all including unmatched, or skip unmatched. Unlinked ingredients can be linked later when editing the recipe.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {pasteReview.filter((i) => !i.isSection).map((ing, ri) => (
                <div key={ri} className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ing.masterIngredientId ? "bg-brand-50 text-brand-700" : "bg-amber-100 text-amber-800"
                  }`}>
                    {ing.masterIngredientId ? <Link2 size={10} /> : <AlertTriangle size={10} />}
                    {ing.name}
                    {ing.quantity != null && ` (${ing.quantity}${ing.unit ? " " + ing.unit : ""})`}
                  </span>
                  {!ing.masterIngredientId && pasteReviewQuickAddIdx !== ri && (
                    <button
                      type="button"
                      onClick={() => setPasteReviewQuickAddIdx(ri)}
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                    >
                      Create in catalog
                    </button>
                  )}
                  {ing.masterIngredientId && (
                    <span className="text-xs text-brand-600">Linked</span>
                  )}
                </div>
              ))}
            </div>

            {pasteReviewQuickAddIdx !== null && (() => {
              const unresolvedNonSections = pasteReview.filter((i) => !i.isSection);
              const target = unresolvedNonSections[pasteReviewQuickAddIdx];
              if (!target || target.masterIngredientId) return null;
              return (
                <IngredientQuickAdd
                  initialName={target.name}
                  ingredients={masterIngredients}
                  onCreate={addCatalogIngredient}
                  onCreated={(mi) => {
                    setPasteReview((prev) => {
                      if (!prev) return prev;
                      let nsIdx = 0;
                      return prev.map((i) => {
                        if (i.isSection) return i;
                        if (nsIdx === pasteReviewQuickAddIdx) {
                          nsIdx++;
                          const pk = ingredientLinkKey(mi.id, "catalog");
                          const nextSubs = (i.substituteLinks ?? []).filter(
                            (s) =>
                              ingredientLinkKey(
                                s.masterIngredientId,
                                s.masterIngredientScope
                              ) !== pk
                          );
                          return {
                            ...i,
                            name: mi.name,
                            nameSecondary: mi.nameGr,
                            masterIngredientId: mi.id,
                            masterIngredientScope: "catalog",
                            substituteLinks: nextSubs,
                          };
                        }
                        nsIdx++;
                        return i;
                      });
                    });
                    setPasteReviewQuickAddIdx(null);
                  }}
                  onCancel={() => setPasteReviewQuickAddIdx(null)}
                />
              );
            })()}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
              <Button
                type="button"
                size="sm"
                onClick={() => applyParsedIngredients(pasteReview)}
              >
                Add All ({pasteReview.filter((i) => !i.isSection).length})
              </Button>
              {pasteReview.some((i) => !i.isSection && !i.masterIngredientId) && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const linked = pasteReview.filter((i) => i.isSection || i.masterIngredientId);
                    if (linked.length > 0) applyParsedIngredients(linked);
                    else { setPasteReview(null); setPasteReviewQuickAddIdx(null); }
                  }}
                >
                  Only Linked ({pasteReview.filter((i) => !i.isSection && i.masterIngredientId).length})
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setPasteReview(null); setPasteReviewQuickAddIdx(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Steps */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Steps</h2>
        <div className="space-y-4">
          {form.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 mt-1">
                {idx + 1}
              </span>
              <div className="flex-1">
                <textarea
                  placeholder={`Step ${idx + 1}...`}
                  value={step.instruction}
                  onChange={(e) =>
                    updateStep(idx, { instruction: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-y min-h-[60px]"
                />
              </div>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                disabled={form.steps.length <= 1}
                className="p-1 text-stone-400 hover:text-red-500 disabled:opacity-30 transition-colors mt-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={addStep}>
            <Plus size={16} />
            Add Step
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStepsPasteOpen((v) => !v)}>
            <ClipboardPaste size={16} />
            Paste List
          </Button>
        </div>
        {stepsPasteOpen && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
            <textarea
              rows={8}
              placeholder={"Paste steps here…\n\nSupports:\n• Plain text (one step per line)\n• HTML from recipe websites"}
              value={stepsPasteText}
              onChange={(e) => setStepsPasteText(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-mono placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handlePasteSteps} disabled={!stepsPasteText.trim()}>
                Parse & Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setStepsPasteOpen(false); setStepsPasteText(""); }}>
                Cancel
              </Button>
              <span className="text-xs text-stone-400 ml-auto">
                HTML from recipe sites and numbered lists are parsed automatically
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Notes</h2>
        <Textarea
          placeholder="Personal notes, tips, variations, substitutions…"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={4}
        />
      </section>

      {/* Submit bar (sticky on mobile) */}
      <div className="sticky bottom-16 md:bottom-0 flex justify-end gap-3 rounded-xl border border-stone-200 bg-white/90 backdrop-blur-sm p-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(-1)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !form.title.trim()}>
          {saving ? <Spinner /> : isEditing ? "Save Changes" : "Create Recipe"}
        </Button>
      </div>
    </form>
  );
}
