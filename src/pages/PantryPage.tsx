import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  ImagePlus,
  Link,
  Link2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { normalizeText } from "@/lib/normalize";
import {
  fetchPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
} from "@/lib/firestore";
import { uploadPantryImage, deletePantryImage } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { useIngredients } from "@/hooks/useIngredients";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IngredientAutocomplete } from "@/components/ui/IngredientAutocomplete";
import { IngredientQuickAdd } from "@/components/ui/IngredientQuickAdd";
import type { PantryItem, PantryCategory } from "@/types/pantry";
import { PANTRY_CATEGORIES, PANTRY_UNITS } from "@/types/pantry";

interface EditState {
  name: string;
  nameSecondary: string;
  quantity: string;
  unit: string;
  masterIngredientId: string | null;
  note: string;
  imageFile: File | null;
  imagePreview: string | null;
  removeImage: boolean;
  imageUrlInput: string;
  showImageUrlInput: boolean;
}

export function PantryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNameSecondary, setNewNameSecondary] = useState("");
  const [newCategory, setNewCategory] = useState<PantryCategory>("Other");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newIsStaple, setNewIsStaple] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showNewImageUrlInput, setShowNewImageUrlInput] = useState(false);
  const [newMasterIngredientId, setNewMasterIngredientId] = useState<
    string | null
  >(null);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAddName, setQuickAddName] = useState<string | null>(null);
  const { ingredients: masterIngredients, add: addCatalogIngredient } = useIngredients();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [duplicateMatch, setDuplicateMatch] = useState<PantryItem | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [clearNonStaplesConfirm, setClearNonStaplesConfirm] = useState(false);
  const [clearEverythingConfirm, setClearEverythingConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCameraInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPantryItems();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearImageSelection = () => {
    setNewImageFile(null);
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImagePreview(null);
    setNewImageUrl("");
    setShowNewImageUrlInput(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleImageSelected = (file: File) => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const findDuplicate = (name: string, masterId: string | null): PantryItem | undefined => {
    if (masterId) {
      return items.find((i) => i.masterIngredientId === masterId);
    }
    const norm = normalizeText(name);
    return items.find((i) => normalizeText(i.name) === norm);
  };

  const commitAdd = async () => {
    setSubmitting(true);
    try {
      const qty = newQuantity ? Number(newQuantity) : null;
      const unit = newUnit || null;
      const nameSecondary = newNameSecondary.trim() || null;

      const id = await addPantryItem({
        name: newName.trim(),
        nameSecondary,
        normalizedName: newName.trim().toLowerCase(),
        category: newCategory,
        quantity: qty,
        unit,
        isStaple: newIsStaple,
        imageUrl: null,
        masterIngredientId: newMasterIngredientId!,
        note: newNote.trim(),
      });

      let imageUrl: string | null = null;
      if (newImageFile) {
        imageUrl = await uploadPantryImage(user!.uid, id, newImageFile);
        await updatePantryItem(id, { imageUrl });
      } else if (newImageUrl.trim()) {
        imageUrl = newImageUrl.trim();
        await updatePantryItem(id, { imageUrl });
      }

      setItems((prev) => [
        ...prev,
        {
          id,
          name: newName.trim(),
          nameSecondary,
          normalizedName: newName.trim().toLowerCase(),
          category: newCategory,
          quantity: qty,
          unit,
          isStaple: newIsStaple,
          imageUrl,
          masterIngredientId: newMasterIngredientId!,
          note: newNote.trim(),
          addedAt: new Date(),
        },
      ]);

      setNewName("");
      setNewNameSecondary("");
      setNewQuantity("");
      setNewUnit("");
      setNewIsStaple(false);
      setNewMasterIngredientId(null);
      setNewNote("");
      clearImageSelection();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const existing = findDuplicate(newName.trim(), newMasterIngredientId);
    if (existing) {
      setDuplicateMatch(existing);
      return;
    }

    await commitAdd();
  };

  const handleToggleStaple = async (item: PantryItem) => {
    await updatePantryItem(item.id, { isStaple: !item.isStaple });
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, isStaple: !i.isStaple } : i
      )
    );
  };

  const handleDelete = async (id: string) => {
    await deletePantryItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearNonStaples = async () => {
    const nonStaples = items.filter((i) => !i.isStaple);
    if (nonStaples.length === 0) return;
    setClearing(true);
    try {
      await Promise.all(nonStaples.map((i) => deletePantryItem(i.id)));
      setItems((prev) => prev.filter((i) => i.isStaple));
    } finally {
      setClearing(false);
      setClearNonStaplesConfirm(false);
    }
  };

  const handleClearEverything = async () => {
    if (items.length === 0) return;
    setClearing(true);
    try {
      await Promise.all(items.map((i) => deletePantryItem(i.id)));
      setItems([]);
    } finally {
      setClearing(false);
      setClearEverythingConfirm(false);
    }
  };

  const startEditing = (item: PantryItem) => {
    setEditingItemId(item.id);
    setEditState({
      name: item.name,
      nameSecondary: item.nameSecondary ?? "",
      quantity: item.quantity?.toString() ?? "",
      unit: item.unit ?? "",
      masterIngredientId: item.masterIngredientId,
      note: item.note ?? "",
      imageFile: null,
      imagePreview: null,
      removeImage: false,
      imageUrlInput: "",
      showImageUrlInput: false,
    });
  };

  const cancelEditing = () => {
    if (editState?.imagePreview) URL.revokeObjectURL(editState.imagePreview);
    setEditingItemId(null);
    setEditState(null);
  };

  const handleEditImageSelected = (file: File) => {
    setEditState((prev) => {
      if (!prev) return prev;
      if (prev.imagePreview) URL.revokeObjectURL(prev.imagePreview);
      return {
        ...prev,
        imageFile: file,
        imagePreview: URL.createObjectURL(file),
        removeImage: false,
      };
    });
  };

  const handleEditRemoveImage = () => {
    setEditState((prev) => {
      if (!prev) return prev;
      if (prev.imagePreview) URL.revokeObjectURL(prev.imagePreview);
      return {
        ...prev,
        imageFile: null,
        imagePreview: null,
        removeImage: true,
      };
    });
  };

  const saveEdit = async (item: PantryItem) => {
    if (!editState || !editState.name.trim()) return;
    setSaving(true);
    try {
      const updates: Partial<PantryItem> = {};
      const trimmedName = editState.name.trim();
      const trimmedSecondary = editState.nameSecondary.trim() || null;
      const qty = editState.quantity ? Number(editState.quantity) : null;
      const unit = editState.unit || null;

      if (trimmedName !== item.name) {
        updates.name = trimmedName;
        updates.normalizedName = trimmedName.toLowerCase();
      }
      if (trimmedSecondary !== item.nameSecondary) {
        updates.nameSecondary = trimmedSecondary;
      }
      if (qty !== item.quantity) updates.quantity = qty;
      if (unit !== item.unit) updates.unit = unit;
      if (editState.masterIngredientId && editState.masterIngredientId !== item.masterIngredientId) {
        updates.masterIngredientId = editState.masterIngredientId;
      }
      const trimmedNote = editState.note.trim();
      if (trimmedNote !== (item.note ?? "")) {
        updates.note = trimmedNote;
      }

      let newImageUrl = item.imageUrl;

      if (editState.removeImage && item.imageUrl) {
        await deletePantryImage(item.imageUrl);
        updates.imageUrl = null;
        newImageUrl = null;
      } else if (editState.imageFile) {
        if (item.imageUrl) await deletePantryImage(item.imageUrl);
        newImageUrl = await uploadPantryImage(
          user!.uid,
          item.id,
          editState.imageFile
        );
        updates.imageUrl = newImageUrl;
      } else if (editState.imageUrlInput.trim()) {
        if (item.imageUrl) await deletePantryImage(item.imageUrl);
        newImageUrl = editState.imageUrlInput.trim();
        updates.imageUrl = newImageUrl;
      }

      if (Object.keys(updates).length > 0) {
        await updatePantryItem(item.id, updates);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                name: trimmedName,
                nameSecondary: trimmedSecondary,
                normalizedName: trimmedName.toLowerCase(),
                quantity: qty,
                unit,
                imageUrl: newImageUrl,
                masterIngredientId: editState.masterIngredientId ?? item.masterIngredientId,
                note: trimmedNote,
              }
            : i
        )
      );
      cancelEditing();
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedCategories(new Set(Object.keys(grouped)));
  };

  const expandAll = () => {
    setCollapsedCategories(new Set());
  };

  const aliasMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const mi of masterIngredients) {
      if (mi.aliases.length > 0) {
        map.set(mi.id, mi.aliases.map(normalizeText));
      }
    }
    return map;
  }, [masterIngredients]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = normalizeText(searchQuery);
    return items.filter((item) => {
      const targets = [
        normalizeText(item.name),
        normalizeText(item.nameSecondary ?? ""),
        normalizeText(item.note ?? ""),
        ...(item.masterIngredientId ? aliasMap.get(item.masterIngredientId) ?? [] : []),
      ].filter(Boolean);
      return targets.some((t) => t.includes(q));
    });
  }, [items, searchQuery, aliasMap]);

  const grouped = PANTRY_CATEGORIES.reduce(
    (acc, cat) => {
      const catItems = filteredItems.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  const categoryKeys = Object.keys(grouped);
  const allCollapsed = categoryKeys.length > 0 && categoryKeys.every((k) => collapsedCategories.has(k));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-stone-800">My Pantry</h1>

      {/* Search */}
      {items.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/60 px-4 py-4 shadow-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
            <input
              type="text"
              placeholder="Type to filter items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-9 pr-8 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add new ingredient */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Plus size={18} />
            </span>
            <span className="text-sm font-semibold text-stone-800">Add ingredient to pantry</span>
          </div>
          {showAddForm ? (
            <ChevronUp size={18} className="text-stone-400" />
          ) : (
            <ChevronDown size={18} className="text-stone-400" />
          )}
        </button>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="space-y-5 border-t border-stone-100 px-5 pb-5 pt-4"
          >
            {/* Ingredient name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-500">Ingredient</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <IngredientAutocomplete
                    ingredients={masterIngredients}
                    value={newName}
                    placeholder="Start typing (e.g. chicken breast, olive oil...)"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
                    onChange={(v) => {
                      setNewName(v);
                      setNewMasterIngredientId(null);
                      setQuickAddName(null);
                    }}
                    onSelect={(mi) => {
                      setNewName(mi.name);
                      setNewNameSecondary(mi.nameGr);
                      setNewMasterIngredientId(mi.id);
                      setQuickAddName(null);
                      if (mi.category) {
                        const pantryMatch = PANTRY_CATEGORIES.find(
                          (c) => c === mi.category
                        );
                        if (pantryMatch) setNewCategory(pantryMatch);
                      }
                    }}
                    onCreateNew={(name) => setQuickAddName(name)}
                  />
                  {newName.trim() && !newMasterIngredientId && (
                    <p className="mt-1 text-xs text-amber-600">Select from catalog or create new</p>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Greek name (optional)"
                    value={newNameSecondary}
                    onChange={(e) => setNewNameSecondary(e.target.value)}
                    readOnly={!!newMasterIngredientId}
                  />
                </div>
              </div>
            </div>

            {/* Quick-add to catalog */}
            {quickAddName && !newMasterIngredientId && (
              <IngredientQuickAdd
                initialName={quickAddName}
                ingredients={masterIngredients}
                onCreate={addCatalogIngredient}
                onCreated={async (mi) => {
                  setQuickAddName(null);

                  const pantryCategory = PANTRY_CATEGORIES.find((c) => c === mi.category) ?? newCategory;
                  const qty = newQuantity ? Number(newQuantity) : null;
                  const unit = newUnit || null;

                  const existing = findDuplicate(mi.name, mi.id);
                  if (existing) {
                    setNewName(mi.name);
                    setNewNameSecondary(mi.nameGr);
                    setNewMasterIngredientId(mi.id);
                    setNewCategory(pantryCategory);
                    setDuplicateMatch(existing);
                    return;
                  }

                  setSubmitting(true);
                  try {
                    const id = await addPantryItem({
                      name: mi.name,
                      nameSecondary: mi.nameGr || null,
                      normalizedName: mi.name.toLowerCase(),
                      category: pantryCategory,
                      quantity: qty,
                      unit,
                      isStaple: newIsStaple,
                      imageUrl: null,
                      masterIngredientId: mi.id,
                      note: newNote.trim(),
                    });

                    setItems((prev) => [
                      ...prev,
                      {
                        id,
                        name: mi.name,
                        nameSecondary: mi.nameGr || null,
                        normalizedName: mi.name.toLowerCase(),
                        category: pantryCategory,
                        quantity: qty,
                        unit,
                        isStaple: newIsStaple,
                        imageUrl: null,
                        masterIngredientId: mi.id,
                        note: newNote.trim(),
                        addedAt: new Date(),
                      },
                    ]);

                    setNewName("");
                    setNewNameSecondary("");
                    setNewQuantity("");
                    setNewUnit("");
                    setNewIsStaple(false);
                    setNewMasterIngredientId(null);
                    setNewNote("");
                    clearImageSelection();
                  } finally {
                    setSubmitting(false);
                  }
                }}
                onCancel={() => setQuickAddName(null)}
              />
            )}

            {/* Category, Quantity, Unit */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-500">Details</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as PantryCategory)
                  }
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {PANTRY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-20 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />

                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="">Unit</option>
                    {PANTRY_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-stone-600 whitespace-nowrap sm:pl-2">
                  <input
                    type="checkbox"
                    checked={newIsStaple}
                    onChange={(e) => setNewIsStaple(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  Staple
                </label>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-500">Note</label>
              <input
                type="text"
                placeholder="Brand, source, or any extra info..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
              />
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-500">Photo</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelected(file);
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelected(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  title="Choose photo"
                >
                  <ImagePlus size={16} />
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  title="Take photo with camera"
                >
                  <Camera size={16} />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewImageUrlInput((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  title="Add image from URL"
                >
                  <Link size={16} />
                  URL
                </button>

                {(newImagePreview || newImageUrl.trim()) && (
                  <div className="relative">
                    <img
                      src={newImagePreview ?? newImageUrl.trim()}
                      alt="Preview"
                      className="h-12 w-12 rounded-lg object-cover border border-stone-200"
                    />
                    <button
                      type="button"
                      onClick={clearImageSelection}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-stone-700 p-0.5 text-white hover:bg-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {showNewImageUrlInput && (
                <input
                  type="url"
                  placeholder="Paste image URL (https://...)"
                  value={newImageUrl}
                  onChange={(e) => {
                    setNewImageUrl(e.target.value);
                    if (newImageFile) {
                      setNewImageFile(null);
                      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
                      setNewImagePreview(null);
                    }
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
                  autoFocus
                />
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-1 border-t border-stone-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNewName("");
                  setNewNameSecondary("");
                  setNewQuantity("");
                  setNewUnit("");
                  setNewIsStaple(false);
                  setNewMasterIngredientId(null);
                  setNewNote("");
                  clearImageSelection();
                  setQuickAddName(null);
                }}
                disabled={submitting}
              >
                Reset
              </Button>
              <Button type="submit" disabled={!newName.trim() || !newMasterIngredientId || submitting}>
                {submitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Plus size={16} />
                )}
                {submitting ? "Adding..." : "Add to pantry"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Grouped list */}
      {categoryKeys.length > 0 ? (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
            >
              {allCollapsed ? (
                <>
                  <ChevronsUpDown size={14} />
                  Expand all
                </>
              ) : (
                <>
                  <ChevronsDownUp size={14} />
                  Collapse all
                </>
              )}
            </button>
          </div>

          {Object.entries(grouped).map(([category, catItems]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <section key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-2 mb-2 group"
                >
                  {isCollapsed ? (
                    <ChevronRight
                      size={16}
                      className="text-stone-400 group-hover:text-stone-600 transition-colors"
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      className="text-stone-400 group-hover:text-stone-600 transition-colors"
                    />
                  )}
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 group-hover:text-stone-700 transition-colors">
                    {category}
                  </h2>
                  <span className="text-xs text-stone-400">
                    ({catItems.length})
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {catItems.map((item) =>
                      editingItemId === item.id && editState ? (
                        <div
                          key={item.id}
                          className="space-y-3 rounded-lg border-2 border-brand-300 bg-brand-50/30 px-4 py-3"
                        >
                          {/* Edit: Names (locked when linked to catalog) */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            {editState.masterIngredientId ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  value={editState.name}
                                  readOnly
                                  className="flex-1 rounded-lg border border-brand-200 bg-brand-50/30 px-3 py-1.5 text-sm text-stone-900 cursor-default"
                                />
                                <span className="text-brand-500 flex-shrink-0" title="Linked to catalog">
                                  <Link2 size={14} />
                                </span>
                              </div>
                            ) : (
                              <IngredientAutocomplete
                                ingredients={masterIngredients}
                                value={editState.name}
                                placeholder="Item name"
                                wrapperClassName="flex-1"
                                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                onChange={(v) =>
                                  setEditState((s) =>
                                    s
                                      ? {
                                          ...s,
                                          name: v,
                                          masterIngredientId: null,
                                        }
                                      : s
                                  )
                                }
                                onSelect={(mi) =>
                                  setEditState((s) =>
                                    s
                                      ? {
                                          ...s,
                                          name: mi.name,
                                          nameSecondary: mi.nameGr,
                                          masterIngredientId: mi.id,
                                        }
                                      : s
                                  )
                                }
                              />
                            )}
                            <input
                              value={editState.nameSecondary}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s
                                    ? { ...s, nameSecondary: e.target.value }
                                    : s
                                )
                              }
                              placeholder="Greek name (optional)"
                              className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              readOnly={!!editState.masterIngredientId}
                            />
                          </div>

                          {/* Edit: Quantity + Unit */}
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Qty"
                              value={editState.quantity}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s ? { ...s, quantity: e.target.value } : s
                                )
                              }
                              className="w-20 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                            <select
                              value={editState.unit}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s ? { ...s, unit: e.target.value } : s
                                )
                              }
                              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            >
                              <option value="">Unit</option>
                              {PANTRY_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Edit: Note */}
                          <input
                            type="text"
                            placeholder="Note (brand, source, etc.)"
                            value={editState.note}
                            onChange={(e) =>
                              setEditState((s) =>
                                s ? { ...s, note: e.target.value } : s
                              )
                            }
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />

                          {/* Edit: Photo */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleEditImageSelected(file);
                                }}
                              />
                              <input
                                ref={editCameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleEditImageSelected(file);
                                }}
                              />

                              {/* Current / new photo preview */}
                              {editState.imagePreview ? (
                                <div className="relative">
                                  <img
                                    src={editState.imagePreview}
                                    alt="New photo"
                                    className="h-12 w-12 rounded-lg object-cover border border-stone-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleEditRemoveImage}
                                    className="absolute -top-1.5 -right-1.5 rounded-full bg-stone-700 p-0.5 text-white hover:bg-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : editState.imageUrlInput.trim() ? (
                                <div className="relative">
                                  <img
                                    src={editState.imageUrlInput.trim()}
                                    alt="URL preview"
                                    className="h-12 w-12 rounded-lg object-cover border border-stone-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditState((s) =>
                                        s ? { ...s, imageUrlInput: "", showImageUrlInput: false, removeImage: true } : s
                                      )
                                    }
                                    className="absolute -top-1.5 -right-1.5 rounded-full bg-stone-700 p-0.5 text-white hover:bg-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : !editState.removeImage && item.imageUrl ? (
                                <div className="relative">
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="h-12 w-12 rounded-lg object-cover border border-stone-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleEditRemoveImage}
                                    className="absolute -top-1.5 -right-1.5 rounded-full bg-stone-700 p-0.5 text-white hover:bg-red-500 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => editFileInputRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                              >
                                <ImagePlus size={14} />
                                {item.imageUrl && !editState.removeImage && !editState.imageFile
                                  ? "Replace"
                                  : "Photo"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  editCameraInputRef.current?.click()
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                              >
                                <Camera size={14} />
                                Camera
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditState((s) =>
                                    s ? { ...s, showImageUrlInput: !s.showImageUrlInput, imageUrlInput: "" } : s
                                  )
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                                title="Add image from URL"
                              >
                                <Link size={14} />
                                URL
                              </button>
                            </div>
                            {editState.showImageUrlInput && (
                              <input
                                type="url"
                                placeholder="Paste image URL (https://...)"
                                value={editState.imageUrlInput}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s
                                      ? {
                                          ...s,
                                          imageUrlInput: e.target.value,
                                          imageFile: null,
                                          imagePreview: null,
                                          removeImage: false,
                                        }
                                      : s
                                  )
                                }
                                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
                                autoFocus
                              />
                            )}
                          </div>

                          {/* Edit: Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(item)}
                              disabled={
                                !editState.name.trim() || saving
                              }
                              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                            >
                              {saving && (
                                <Spinner className="h-3 w-3" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="rounded-lg px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-9 w-9 rounded-md object-cover border border-stone-200 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-stone-800">
                                  {item.name}
                                </span>
                                {item.nameSecondary && (
                                  <span className="text-sm italic text-stone-400">
                                    ({item.nameSecondary})
                                  </span>
                                )}
                                {item.masterIngredientId && (
                                  <span className="text-brand-400" title="Linked to catalog">
                                    <Link2 size={12} />
                                  </span>
                                )}
                                {item.isStaple && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    Staple
                                  </span>
                                )}
                              </div>
                              {(item.quantity != null || item.unit) && (
                                <span className="text-xs text-stone-400 mt-0.5 block">
                                  {item.quantity}
                                  {item.unit ? ` ${item.unit}` : ""}
                                </span>
                              )}
                              {item.note && (
                                <span className="text-xs italic text-stone-400 mt-0.5 block">
                                  {item.note}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => startEditing(item)}
                              className="p-1 text-stone-400 hover:text-brand-600 transition-colors"
                              title="Edit item"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleStaple(item)}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                item.isStaple
                                  ? "text-amber-600 hover:bg-amber-50"
                                  : "text-stone-400 hover:bg-stone-50"
                              }`}
                              title={
                                item.isStaple
                                  ? "Remove staple"
                                  : "Mark as staple"
                              }
                            >
                              {item.isStaple ? "Unstaple" : "Staple"}
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {/* Clear actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
            {items.some((i) => !i.isStaple) && (
              <button
                onClick={() => setClearNonStaplesConfirm(true)}
                disabled={clearing}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                title="Remove all items except staples"
              >
                <Trash2 size={14} />
                {clearing ? "Clearing…" : "Clear non-staples"}
              </button>
            )}
            <button
              onClick={() => setClearEverythingConfirm(true)}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
              title="Remove all pantry items including staples"
            >
              <Trash2 size={14} />
              {clearing ? "Clearing…" : "Clear all"}
            </button>
          </div>
        </div>
      ) : searchQuery.trim() ? (
        <EmptyState
          icon={<Search size={48} />}
          title="No matches"
          description={`No pantry items match "${searchQuery}".`}
        />
      ) : (
        <EmptyState
          icon={<Package size={48} />}
          title="Pantry is empty"
          description="Add items you have at home. Mark staples like salt and oil so they're always counted."
        />
      )}

      <ConfirmDialog
        open={!!duplicateMatch}
        title="Duplicate item"
        message={
          duplicateMatch
            ? `"${duplicateMatch.name}" is already in your pantry${duplicateMatch.category ? ` (${duplicateMatch.category})` : ""}. Add it anyway?`
            : ""
        }
        confirmLabel="Add anyway"
        variant="primary"
        onConfirm={async () => {
          setDuplicateMatch(null);
          await commitAdd();
        }}
        onCancel={() => setDuplicateMatch(null)}
      />

      <ConfirmDialog
        open={clearNonStaplesConfirm}
        title="Clear non-staple items"
        message={`This will remove ${items.filter((i) => !i.isStaple).length} item(s) from your pantry. Staple items will be kept. This cannot be undone.`}
        confirmLabel="Remove all non-staples"
        variant="danger"
        onConfirm={handleClearNonStaples}
        onCancel={() => setClearNonStaplesConfirm(false)}
      />

      <ConfirmDialog
        open={clearEverythingConfirm}
        title="Clear entire pantry"
        message={`This will permanently remove all ${items.length} item(s) from your pantry, including staples. This cannot be undone.`}
        confirmLabel="Remove everything"
        variant="danger"
        onConfirm={handleClearEverything}
        onCancel={() => setClearEverythingConfirm(false)}
      />
    </div>
  );
}
