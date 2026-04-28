import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
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
  PackageOpen,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { normalizeText } from "@/lib/normalize";
import {
  fetchPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
  refreshPantryItem,
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
import type { MasterIngredientScope } from "@/types/ingredientRef";
import { ingredientLinkKey, masterScopeFromMasterIngredient } from "@/lib/ingredientRef";
import { navigateToSuggestionsForIngredient } from "@/lib/suggestionsNavigation";
import {
  formatExpiresOnLabel,
  getPantryExpiryAlertMessage,
  getPantryExpiryDisplayStatus,
  type PantryExpiryDisplayStatus,
} from "@/lib/pantryExpiry";

type PantryListQuickFilter = "expired" | "expiringSoon" | "staples";

function pantryExpiryCardClasses(status: PantryExpiryDisplayStatus): string {
  switch (status) {
    case "expired":
      return "border-red-300 bg-red-50/70";
    case "expiringSoon":
      return "border-amber-300 bg-amber-50/70";
    default:
      return "border-stone-200 bg-white";
  }
}

interface EditState {
  name: string;
  nameSecondary: string;
  quantity: string;
  unit: string;
  masterIngredientId: string | null;
  masterIngredientScope: MasterIngredientScope;
  note: string;
  expiresOn: string;
  isOpened: boolean;
  imageFile: File | null;
  imagePreview: string | null;
  removeImage: boolean;
  imageUrlInput: string;
  showImageUrlInput: boolean;
}

export function PantryPage() {
  const navigate = useNavigate();
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
  const [newMasterIngredientScope, setNewMasterIngredientScope] =
    useState<MasterIngredientScope>(null);
  const [newNote, setNewNote] = useState("");
  const [newExpiresOn, setNewExpiresOn] = useState("");
  const [newIsOpened, setNewIsOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listQuickFilter, setListQuickFilter] =
    useState<PantryListQuickFilter | null>(null);
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
  const [pantryItemToDelete, setPantryItemToDelete] = useState<PantryItem | null>(
    null
  );
  const [pantryItemToRefresh, setPantryItemToRefresh] = useState<PantryItem | null>(
    null
  );

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

  const findDuplicate = (
    name: string,
    masterId: string | null,
    masterScope: MasterIngredientScope = null
  ): PantryItem | undefined => {
    if (masterId) {
      const want = ingredientLinkKey(masterId, masterScope);
      return items.find(
        (i) => ingredientLinkKey(i.masterIngredientId, i.masterIngredientScope) === want
      );
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

      const expiresOn = newExpiresOn.trim() || null;

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
        masterIngredientScope: newMasterIngredientScope,
        note: newNote.trim(),
        expiresOn,
        isOpened: newIsOpened,
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
          masterIngredientScope: newMasterIngredientScope,
          note: newNote.trim(),
          expiresOn,
          isOpened: newIsOpened,
          addedAt: new Date(),
        },
      ]);

      setNewName("");
      setNewNameSecondary("");
      setNewQuantity("");
      setNewUnit("");
      setNewIsStaple(false);
      setNewMasterIngredientId(null);
      setNewMasterIngredientScope(null);
      setNewNote("");
      setNewExpiresOn("");
      setNewIsOpened(false);
      clearImageSelection();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const existing = findDuplicate(
      newName.trim(),
      newMasterIngredientId,
      newMasterIngredientScope
    );
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

  const handleRefreshPantryItem = async (item: PantryItem) => {
    setRefreshingItemId(item.id);
    try {
      await refreshPantryItem(item.id);
      const now = new Date();
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                quantity: null,
                unit: null,
                note: "",
                expiresOn: null,
                isOpened: false,
                imageUrl: null,
                addedAt: now,
              }
            : i
        )
      );
      if (editingItemId === item.id) cancelEditing();
      setExpandedItemId((id) => (id === item.id ? null : id));
    } finally {
      setRefreshingItemId(null);
    }
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
    setExpandedItemId(null);
    setEditingItemId(item.id);
    setEditState({
      name: item.name,
      nameSecondary: item.nameSecondary ?? "",
      quantity: item.quantity?.toString() ?? "",
      unit: item.unit ?? "",
      masterIngredientId: item.masterIngredientId,
      masterIngredientScope: item.masterIngredientScope,
      note: item.note ?? "",
      expiresOn: item.expiresOn ?? "",
      isOpened: item.isOpened,
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
      if (
        editState.masterIngredientId &&
        (editState.masterIngredientId !== item.masterIngredientId ||
          editState.masterIngredientScope !== item.masterIngredientScope)
      ) {
        updates.masterIngredientId = editState.masterIngredientId;
        updates.masterIngredientScope = editState.masterIngredientScope;
      }
      const trimmedNote = editState.note.trim();
      if (trimmedNote !== (item.note ?? "")) {
        updates.note = trimmedNote;
      }

      const nextExpiresOn = editState.expiresOn.trim() || null;
      if (nextExpiresOn !== (item.expiresOn ?? null)) {
        updates.expiresOn = nextExpiresOn;
      }
      if (editState.isOpened !== item.isOpened) {
        updates.isOpened = editState.isOpened;
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
                masterIngredientScope: editState.masterIngredientId
                  ? editState.masterIngredientScope
                  : null,
                note: trimmedNote,
                expiresOn: nextExpiresOn,
                isOpened: editState.isOpened,
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
        const k = ingredientLinkKey(mi.id, masterScopeFromMasterIngredient(mi));
        if (k) map.set(k, mi.aliases.map(normalizeText));
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
        ...(ingredientLinkKey(item.masterIngredientId, item.masterIngredientScope)
          ? aliasMap.get(
              ingredientLinkKey(item.masterIngredientId, item.masterIngredientScope)!
            ) ?? []
          : []),
      ].filter(Boolean);
      return targets.some((t) => t.includes(q));
    });
  }, [items, searchQuery, aliasMap]);

  const displayItems = useMemo(() => {
    if (listQuickFilter === null) return filteredItems;
    if (listQuickFilter === "staples") {
      return filteredItems.filter((i) => i.isStaple);
    }
    if (listQuickFilter === "expired") {
      return filteredItems.filter(
        (i) => getPantryExpiryDisplayStatus(i.expiresOn) === "expired"
      );
    }
    return filteredItems.filter(
      (i) => getPantryExpiryDisplayStatus(i.expiresOn) === "expiringSoon"
    );
  }, [filteredItems, listQuickFilter]);

  const grouped = PANTRY_CATEGORIES.reduce(
    (acc, cat) => {
      const catItems = displayItems.filter((i) => i.category === cat);
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

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                {
                  id: "expired" as const,
                  label: "Expired",
                  icon: AlertTriangle,
                },
                {
                  id: "expiringSoon" as const,
                  label: "Expiring soon",
                  icon: Calendar,
                },
                { id: "staples" as const, label: "Staples", icon: Paperclip },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = listQuickFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setListQuickFilter((cur) => (cur === id ? null : id))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                      : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300 hover:bg-white"
                  }`}
                >
                  <Icon size={14} className={active ? "opacity-95" : "opacity-70"} />
                  {label}
                </button>
              );
            })}
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
                      setNewMasterIngredientScope(null);
                      setQuickAddName(null);
                    }}
                    onSelect={(mi) => {
                      setNewName(mi.name);
                      setNewNameSecondary(mi.nameGr);
                      setNewMasterIngredientId(mi.id);
                      setNewMasterIngredientScope(masterScopeFromMasterIngredient(mi));
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

                  const existing = findDuplicate(mi.name, mi.id, "catalog");
                  if (existing) {
                    setNewName(mi.name);
                    setNewNameSecondary(mi.nameGr);
                    setNewMasterIngredientId(mi.id);
                    setNewMasterIngredientScope("catalog");
                    setNewCategory(pantryCategory);
                    setDuplicateMatch(existing);
                    return;
                  }

                  setSubmitting(true);
                  try {
                    const expiresOn = newExpiresOn.trim() || null;
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
                      masterIngredientScope: "catalog",
                      note: newNote.trim(),
                      expiresOn,
                      isOpened: newIsOpened,
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
                        masterIngredientScope: "catalog" as const,
                        note: newNote.trim(),
                        expiresOn,
                        isOpened: newIsOpened,
                        addedAt: new Date(),
                      },
                    ]);

                    setNewName("");
                    setNewNameSecondary("");
                    setNewQuantity("");
                    setNewUnit("");
                    setNewIsStaple(false);
                    setNewMasterIngredientId(null);
                    setNewMasterIngredientScope(null);
                    setNewNote("");
                    setNewExpiresOn("");
                    setNewIsOpened(false);
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

            {/* Expiry & opened */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Expiry date
                </label>
                <input
                  type="date"
                  value={newExpiresOn}
                  onChange={(e) => setNewExpiresOn(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600 pb-2.5 sm:pb-0">
                <input
                  type="checkbox"
                  checked={newIsOpened}
                  onChange={(e) => setNewIsOpened(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                Opened (e.g. partial pack)
              </label>
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
                  setNewMasterIngredientScope(null);
                  setNewNote("");
                  setNewExpiresOn("");
                  setNewIsOpened(false);
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
                                          masterIngredientScope: null,
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
                                          masterIngredientScope: masterScopeFromMasterIngredient(mi),
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
                              className={
                                editState.masterIngredientId
                                  ? "flex-1 rounded-lg border border-brand-200 bg-brand-50/30 px-3 py-1.5 text-sm text-stone-900 cursor-default focus:outline-none"
                                  : "flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              }
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

                          {/* Edit: Expiry & opened */}
                          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                            <div className="space-y-1">
                              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                                Expiry date
                              </span>
                              <input
                                type="date"
                                value={editState.expiresOn}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s ? { ...s, expiresOn: e.target.value } : s
                                  )
                                }
                                className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-stone-600">
                              <input
                                type="checkbox"
                                checked={editState.isOpened}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s ? { ...s, isOpened: e.target.checked } : s
                                  )
                                }
                                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                              />
                              Opened
                            </label>
                          </div>

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
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
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
                              type="button"
                              onClick={cancelEditing}
                              disabled={saving}
                              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStaple(item)}
                              disabled={saving}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                item.isStaple
                                  ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                              }`}
                              title={
                                item.isStaple
                                  ? "Remove staple"
                                  : "Mark as staple"
                              }
                            >
                              {item.isStaple ? "Unstaple" : "Staple"}
                            </button>
                          </div>
                        </div>
                      ) : (() => {
                        const expStatus = getPantryExpiryDisplayStatus(
                          item.expiresOn
                        );
                        const alertMsg = getPantryExpiryAlertMessage(
                          item.expiresOn
                        );
                        const expanded = expandedItemId === item.id;
                        const headId = `pantry-item-${item.id}-head`;
                        const panelId = `pantry-item-${item.id}-panel`;
                        const hasAmount =
                          item.quantity != null || Boolean(item.unit?.trim());
                        const hasExpiry = Boolean(item.expiresOn?.trim());
                        const hasNote = Boolean(item.note?.trim());
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border overflow-hidden transition-[box-shadow,background-color] duration-200 ease-out ${pantryExpiryCardClasses(
                              expStatus
                            )} ${
                              expanded
                                ? "shadow-md ring-1 ring-stone-200/70"
                                : "shadow-sm"
                            }`}
                          >
                            <div className="flex items-start gap-1 px-2 py-2 sm:px-3 sm:py-2.5">
                              <button
                                type="button"
                                id={headId}
                                aria-expanded={expanded}
                                aria-controls={panelId}
                                onClick={() =>
                                  setExpandedItemId((id) =>
                                    id === item.id ? null : item.id
                                  )
                                }
                                className="min-w-0 flex-1 text-left rounded-lg px-1.5 py-1 -mx-0.5 -my-0.5 hover:bg-stone-900/[0.04] active:bg-stone-900/[0.08] active:scale-[0.995] transition-[background-color,transform,box-shadow] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                              >
                                <div className="flex items-start gap-2">
                                  {expanded ? (
                                    <ChevronDown
                                      size={16}
                                      className="mt-0.5 flex-shrink-0 text-stone-400"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={16}
                                      className="mt-0.5 flex-shrink-0 text-stone-400"
                                      aria-hidden
                                    />
                                  )}
                                  {item.imageUrl && (
                                    <img
                                      src={item.imageUrl}
                                      alt=""
                                      className="h-9 w-9 rounded-md object-cover border border-stone-200 flex-shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-stone-800">
                                        {item.name}
                                      </span>
                                      {item.nameSecondary && (
                                        <span className="text-sm italic text-stone-400">
                                          ({item.nameSecondary})
                                        </span>
                                      )}
                                      {item.masterIngredientId && (
                                        <span
                                          className="inline-flex shrink-0 text-brand-500"
                                          title="Linked to catalog"
                                          aria-label="Linked to catalog"
                                        >
                                          <Link2 size={14} aria-hidden />
                                        </span>
                                      )}
                                    </div>
                                    {hasExpiry && alertMsg ? (
                                      <span
                                        className={`text-xs flex items-center gap-1 font-medium ${
                                          expStatus === "expired"
                                            ? "text-red-700"
                                            : "text-amber-800"
                                        }`}
                                      >
                                        {expStatus === "expired" ? (
                                          <AlertTriangle
                                            size={12}
                                            className="flex-shrink-0"
                                            aria-hidden
                                          />
                                        ) : (
                                          <Calendar
                                            size={12}
                                            className="flex-shrink-0"
                                            aria-hidden
                                          />
                                        )}
                                        {alertMsg}
                                      </span>
                                    ) : null}
                                    {hasAmount ? (
                                      <span className="text-xs text-stone-500 block tabular-nums">
                                        {item.quantity ?? ""}
                                        {item.unit ? ` ${item.unit}` : ""}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </button>

                              <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => startEditing(item)}
                                    disabled={refreshingItemId === item.id}
                                    className="p-1.5 text-stone-400 hover:text-brand-600 transition-colors rounded-md hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40"
                                    title="Edit item"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  {item.masterIngredientId?.trim() && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigateToSuggestionsForIngredient(
                                          navigate,
                                          item.masterIngredientId.trim(),
                                          item.masterIngredientScope,
                                          { forceAsExtra: true }
                                        )
                                      }
                                      className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors rounded-md hover:bg-stone-100"
                                      title="Recipe suggestions"
                                      aria-label="Recipe suggestions with this ingredient"
                                    >
                                      <Sparkles size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setPantryItemToRefresh(item)}
                                    disabled={refreshingItemId === item.id}
                                    className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors rounded-md hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40"
                                    title="Restock — clear amount, note, expiry, opened, and photo; date added becomes today"
                                    aria-label={`Restock ${item.name}`}
                                  >
                                    {refreshingItemId === item.id ? (
                                      <Spinner className="h-3.5 w-3.5" />
                                    ) : (
                                      <RefreshCw size={14} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPantryItemToDelete(item)}
                                    disabled={refreshingItemId === item.id}
                                    className="p-1.5 text-stone-400 hover:text-red-500 transition-colors rounded-md hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40"
                                    aria-label={`Remove ${item.name}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                {(item.isOpened ||
                                  item.isStaple ||
                                  item.expiresOn) && (
                                  <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 pr-0.5">
                                    {item.isOpened ? (
                                      <span
                                        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800"
                                        title="Opened"
                                        aria-label="Opened pack"
                                      >
                                        <PackageOpen
                                          size={12}
                                          strokeWidth={2.25}
                                          aria-hidden
                                        />
                                      </span>
                                    ) : null}
                                    {item.isStaple ? (
                                      <span
                                        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                                        title="Staple"
                                        aria-label="Staple"
                                      >
                                        <Paperclip
                                          size={12}
                                          strokeWidth={2.25}
                                          aria-hidden
                                        />
                                      </span>
                                    ) : null}
                                    {item.expiresOn ? (
                                      <span
                                        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-300 text-stone-800"
                                        title="Expiry date set"
                                        aria-label="Has expiry date"
                                      >
                                        <Calendar
                                          size={12}
                                          className="flex-shrink-0"
                                          aria-hidden
                                        />
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div
                              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                              }`}
                            >
                              <div className="min-h-0 overflow-hidden">
                                <div
                                  id={panelId}
                                  role="region"
                                  aria-labelledby={headId}
                                  aria-hidden={!expanded}
                                  className="border-t border-stone-100 bg-stone-50/70 px-4 py-4 sm:px-5 text-sm"
                                >
                                  <div className="flex flex-col gap-0">
                                    {hasExpiry ? (
                                      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-1.5 border-b border-stone-100/90 pb-3.5">
                                        <span className="text-xs font-medium uppercase tracking-wide text-stone-400 shrink-0 pt-0.5">
                                          Expiry
                                        </span>
                                        <div className="min-w-0 text-right">
                                          <span className="text-stone-900">
                                            {formatExpiresOnLabel(
                                              item.expiresOn!
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ) : null}

                                    {hasAmount ? (
                                      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-stone-100/90 py-3.5">
                                        <span className="text-xs font-medium uppercase tracking-wide text-stone-400 shrink-0">
                                          Amount
                                        </span>
                                        <span className="text-stone-900 tabular-nums text-right">
                                          {item.quantity ?? "—"}
                                          {item.unit ? (
                                            <span className="text-stone-600">
                                              {" "}
                                              {item.unit}
                                            </span>
                                          ) : null}
                                        </span>
                                      </div>
                                    ) : null}

                                    {item.isOpened ? (
                                      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-stone-100/90 py-3.5">
                                        <span className="text-xs font-medium uppercase tracking-wide text-stone-400 shrink-0">
                                          Opened
                                        </span>
                                        <span className="text-stone-900">
                                          Yes
                                        </span>
                                      </div>
                                    ) : null}

                                    <div
                                      className={`flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-3.5 ${
                                        hasNote
                                          ? "border-b border-stone-100/90"
                                          : ""
                                      }`}
                                    >
                                      <span className="text-xs font-medium uppercase tracking-wide text-stone-400 shrink-0">
                                        Date added
                                      </span>
                                      <span className="text-stone-900 text-right">
                                        {item.addedAt.toLocaleDateString(
                                          undefined,
                                          {
                                            weekday: "short",
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                          }
                                        )}
                                      </span>
                                    </div>

                                    {hasNote ? (
                                      <div className="pt-1">
                                        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                                          Note
                                        </span>
                                        <p className="mt-2 text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
                                          {item.note}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
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
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="Pantry is empty"
          description="Add items you have at home. Mark staples like salt and oil so they're always counted."
        />
      ) : filteredItems.length === 0 && searchQuery.trim() ? (
        <EmptyState
          icon={<Search size={48} />}
          title="No matches"
          description={`No pantry items match "${searchQuery}".`}
        />
      ) : displayItems.length === 0 && listQuickFilter !== null ? (
        <EmptyState
          icon={
            listQuickFilter === "expired" ? (
              <AlertTriangle size={48} />
            ) : listQuickFilter === "expiringSoon" ? (
              <Calendar size={48} />
            ) : (
              <Paperclip size={48} />
            )
          }
          title={
            listQuickFilter === "expired"
              ? "Nothing expired"
              : listQuickFilter === "expiringSoon"
                ? "Nothing expiring soon"
                : "No staples in this view"
          }
          description={
            listQuickFilter === "expired"
              ? searchQuery.trim()
                ? "No matching items are past their expiry. Try another filter or clear the search."
                : "No items are past their expiry date."
              : listQuickFilter === "expiringSoon"
                ? searchQuery.trim()
                  ? "No matching items expire within the next week. Try another filter or clear the search."
                  : "No items expire within the next week. Items without a date set won't appear here."
                : searchQuery.trim()
                  ? "No matching items are marked as staples. Try another filter or clear the search."
                  : "Mark pantry items as staples when you add or edit them so they show up here."
          }
        />
      ) : (
        <EmptyState
          icon={<Package size={48} />}
          title="Nothing to show"
          description="Try adjusting your search or filters."
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

      <ConfirmDialog
        open={!!pantryItemToDelete}
        title="Remove from pantry"
        message={
          pantryItemToDelete
            ? `Remove “${pantryItemToDelete.name}” from your pantry? This cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (!pantryItemToDelete) return;
          const id = pantryItemToDelete.id;
          setPantryItemToDelete(null);
          await handleDelete(id);
        }}
        onCancel={() => setPantryItemToDelete(null)}
      />

      <ConfirmDialog
        open={!!pantryItemToRefresh}
        title="Restock item"
        message={
          pantryItemToRefresh
            ? `Reset “${pantryItemToRefresh.name}” for a new purchase? Amount, unit, note, expiry, opened flag, and photo will be cleared, and date added will be set to today.`
            : ""
        }
        confirmLabel="Restock"
        variant="primary"
        onConfirm={async () => {
          if (!pantryItemToRefresh) return;
          const item = pantryItemToRefresh;
          setPantryItemToRefresh(null);
          await handleRefreshPantryItem(item);
        }}
        onCancel={() => setPantryItemToRefresh(null)}
      />
    </div>
  );
}
