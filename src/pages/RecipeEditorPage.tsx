import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, ImagePlus, Link, Link2, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useRecipe, useRecipeMutations } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useIngredients } from "@/hooks/useIngredients";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TagChip } from "@/components/ui/TagChip";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Spinner } from "@/components/ui/Spinner";
import { IngredientAutocomplete } from "@/components/ui/IngredientAutocomplete";
import type { Ingredient, Step, RecipeFormData } from "@/types/recipe";

function emptyIngredient(sortOrder: number): Ingredient {
  return { name: "", nameSecondary: "", quantity: null, unit: "", sortOrder, masterIngredientId: null, note: "" };
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
  const { ingredients: masterIngredients } = useIngredients();

  const [form, setForm] = useState<RecipeFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [noteOpenSet, setNoteOpenSet] = useState<Set<number>>(new Set());
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);

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

  const removeIngredient = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients
        .filter((_, i) => i !== idx)
        .map((ing, i) => ({ ...ing, sortOrder: i })),
    }));
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
    const tempId = id ?? "temp-" + Date.now();
    const newUrls: string[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      newPreviews.push(URL.createObjectURL(file));
      const url = await upload(tempId, file);
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
        <h1 className="text-xl font-bold text-stone-800">
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
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setField(
                    "categoryId",
                    form.categoryId === cat.id ? null : cat.id
                  )
                }
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border ${
                  form.categoryId === cat.id
                    ? "border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-400/30"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <CategoryIcon icon={cat.icon} size={16} />
                {cat.name}
              </button>
            ))}
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
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-800">Tags</h2>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                selected={form.tags.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ))}
          </div>
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
          {form.ingredients.map((ing, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <GripVertical size={16} className="text-stone-300 flex-shrink-0" />
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
                className="w-16 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <input
                type="text"
                placeholder="Unit"
                value={ing.unit}
                onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <IngredientAutocomplete
                ingredients={masterIngredients}
                value={ing.name}
                placeholder="Ingredient name"
                wrapperClassName="flex-1 min-w-[180px]"
                className={`w-full rounded-lg border bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                  ing.masterIngredientId
                    ? "border-brand-300 bg-brand-50/30"
                    : "border-stone-300"
                }`}
                onChange={(v) => updateIngredient(idx, { name: v, masterIngredientId: null })}
                onSelect={(mi) =>
                  updateIngredient(idx, {
                    name: mi.name,
                    nameSecondary: mi.nameGr,
                    masterIngredientId: mi.id,
                  })
                }
              />
              {ing.masterIngredientId ? (
                <span title="Linked to catalog" className="flex-shrink-0 text-brand-500">
                  <Link2 size={14} />
                </span>
              ) : (
                ing.name.trim() && (
                  <span title="Not in catalog" className="flex-shrink-0 text-stone-300">
                    <Link2 size={14} />
                  </span>
                )
              )}
              {noteOpenSet.has(idx) ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="e.g. diced, melted..."
                    value={ing.note}
                    onChange={(e) => updateIngredient(idx, { note: e.target.value })}
                    autoFocus
                    className="w-40 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm italic text-stone-500 placeholder:text-stone-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateIngredient(idx, { note: "" });
                      setNoteOpenSet((prev) => { const next = new Set(prev); next.delete(idx); return next; });
                    }}
                    className="p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
                    title="Remove note"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteOpenSet((prev) => new Set(prev).add(idx))}
                  className={`p-1 transition-colors flex-shrink-0 ${
                    ing.note ? "text-brand-500" : "text-stone-300 hover:text-stone-500"
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
                className="p-1 text-stone-400 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addIngredient}>
          <Plus size={16} />
          Add Ingredient
        </Button>
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
        <Button type="button" variant="ghost" size="sm" onClick={addStep}>
          <Plus size={16} />
          Add Step
        </Button>
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
