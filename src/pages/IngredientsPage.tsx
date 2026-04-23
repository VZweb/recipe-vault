import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Egg,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useIngredients } from "@/hooks/useIngredients";
import { useAuth } from "@/contexts/AuthContext";
import { refreshAuthIdToken } from "@/lib/firebase";
import { normalizeText } from "@/lib/normalize";
import { addPantryItem, fetchPantryItems } from "@/lib/firestore";
import { ingredientLinkKey, masterScopeFromMasterIngredient } from "@/lib/ingredientRef";
import type { PantryItem } from "@/types/pantry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IngredientAutocomplete } from "@/components/ui/IngredientAutocomplete";
import type { MasterIngredient, IngredientCategory } from "@/types/ingredient";
import { INGREDIENT_CATEGORIES } from "@/types/ingredient";

interface EditState {
  name: string;
  nameGr: string;
  aliases: string[];
  aliasInput: string;
  category: IngredientCategory;
}

export function IngredientsPage() {
  const { user, catalogAdmin } = useAuth();
  const { ingredients, loading, add, addCatalog, update, remove } = useIngredients();
  const [newName, setNewName] = useState("");
  const [newNameGr, setNewNameGr] = useState("");
  const [newCategory, setNewCategory] =
    useState<IngredientCategory>("Other");
  const [newAliases, setNewAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    isCatalog: boolean;
  } | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<MasterIngredient | null>(null);
  const [addAsCatalog, setAddAsCatalog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (catalogAdmin) setAddAsCatalog(true);
    else setAddAsCatalog(false);
  }, [catalogAdmin]);

  useEffect(() => {
    if (!catalogAdmin || !user) return;
    void user.getIdToken(true);
  }, [catalogAdmin, user]);

  const [pantryIds, setPantryIds] = useState<Set<string>>(new Set()); // ingredientLinkKey values
  const [addedToPantry, setAddedToPantry] = useState<Set<string>>(new Set());

  const loadPantryIds = useCallback(async () => {
    const items = await fetchPantryItems();
    setPantryIds(
      new Set(
        items
          .map((i: PantryItem) =>
            ingredientLinkKey(i.masterIngredientId, i.masterIngredientScope)
          )
          .filter((k): k is string => k !== null)
      )
    );
  }, []);

  useEffect(() => {
    void loadPantryIds();
  }, [loadPantryIds]);

  const handleAddToPantry = async (item: MasterIngredient) => {
    await addPantryItem({
      name: item.name,
      nameSecondary: item.nameGr || null,
      normalizedName: item.name.toLowerCase(),
      category: item.category as PantryItem["category"],
      quantity: null,
      unit: null,
      isStaple: false,
      imageUrl: null,
      masterIngredientId: item.id,
      masterIngredientScope: masterScopeFromMasterIngredient(item),
      note: "",
      expiresOn: null,
      isOpened: false,
    });
    const pk = ingredientLinkKey(item.id, masterScopeFromMasterIngredient(item))!;
    setPantryIds((prev) => new Set(prev).add(pk));
    setAddedToPantry((prev) => new Set(prev).add(pk));
  };

  const [searchQuery, setSearchQuery] = useState("");

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  const filteredIngredients = useMemo(() => {
    const q = normalizeText(searchQuery);
    if (!q) return ingredients;
    return ingredients.filter((ing) => {
      const targets = [
        normalizeText(ing.name),
        normalizeText(ing.nameGr),
        ...ing.aliases.map(normalizeText),
      ].filter(Boolean);
      return targets.some((t) => t.includes(q));
    });
  }, [ingredients, searchQuery]);

  const handleAddAlias = () => {
    const alias = newAliasInput.trim();
    if (!alias || newAliases.includes(alias)) return;
    setNewAliases((prev) => [...prev, alias]);
    setNewAliasInput("");
  };

  const findDuplicate = (name: string, nameGr: string, aliases: string[]): MasterIngredient | undefined => {
    const incoming = [name, nameGr, ...aliases].map(normalizeText).filter(Boolean);
    return ingredients.find((ing) => {
      const existing = [
        normalizeText(ing.name),
        normalizeText(ing.nameGr),
        ...ing.aliases.map(normalizeText),
      ].filter(Boolean);
      return incoming.some((i) => existing.some((e) => i === e));
    });
  };

  const commitAdd = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: newName.trim(),
        nameGr: newNameGr.trim(),
        aliases: newAliases,
        category: newCategory,
      };
      if (catalogAdmin && addAsCatalog) {
        await addCatalog(payload);
      } else {
        await add(payload);
      }
      setNewName("");
      setNewNameGr("");
      setNewAliases([]);
      setNewAliasInput("");
      setNewCategory("Other");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not save. Check the console or try again.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setFormError(null);

    const existing = findDuplicate(newName.trim(), newNameGr.trim(), newAliases);
    if (existing) {
      setDuplicateMatch(existing);
      return;
    }

    await commitAdd();
  };

  const startEditing = (item: MasterIngredient) => {
    if (item.isCatalog && !catalogAdmin) return;
    setEditingId(item.id);
    setEditState({
      name: item.name,
      nameGr: item.nameGr,
      aliases: [...item.aliases],
      aliasInput: "",
      category: item.category,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditState(null);
  };

  const handleEditAddAlias = () => {
    if (!editState) return;
    const alias = editState.aliasInput.trim();
    if (!alias || editState.aliases.includes(alias)) return;
    setEditState((s) =>
      s ? { ...s, aliases: [...s.aliases, alias], aliasInput: "" } : s
    );
  };

  const saveEdit = async (item: MasterIngredient) => {
    if ((item.isCatalog && !catalogAdmin) || !editState || !editState.name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (item.isCatalog && catalogAdmin) {
        await refreshAuthIdToken();
      }
      await update(
        item.id,
        {
          name: editState.name.trim(),
          nameGr: editState.nameGr.trim(),
          aliases: editState.aliases,
          category: editState.category,
        },
        !!item.isCatalog
      );
      cancelEditing();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not update. Try again or refresh the page."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setFormError(null);
    try {
      const row = ingredients.find(
        (i) =>
          i.id === deleteTarget.id &&
          Boolean(i.isCatalog) === deleteTarget.isCatalog
      );
      if (row?.isCatalog && catalogAdmin) {
        await refreshAuthIdToken();
      }
      await remove(deleteTarget.id, deleteTarget.isCatalog);
      setDeleteTarget(null);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not delete. Try again or refresh the page."
      );
      setDeleteTarget(null);
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

  const grouped = INGREDIENT_CATEGORIES.reduce(
    (acc, cat) => {
      const catItems = filteredIngredients.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    },
    {} as Record<string, MasterIngredient[]>
  );

  const categoryKeys = Object.keys(grouped);
  const allCollapsed =
    categoryKeys.length > 0 &&
    categoryKeys.every((k) => collapsedCategories.has(k));

  const collapseAll = () =>
    setCollapsedCategories(new Set(categoryKeys));
  const expandAll = () => setCollapsedCategories(new Set());

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-stone-800">
          Ingredient Catalog
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Shared catalog entries are the same for everyone; only the catalog
          administrator can change them. Anyone can add personal ingredients.
          Recipes and pantry link here for matching.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search ingredients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        {formError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <IngredientAutocomplete
              ingredients={ingredients}
              value={newName}
              placeholder="Name (English)"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
              onChange={(v) => setNewName(v)}
              onSelect={(mi) => {
                setDuplicateMatch(mi);
                setNewName(mi.name);
              }}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Name (Greek)"
              value={newNameGr}
              onChange={(e) => setNewNameGr(e.target.value)}
            />
          </div>
          <select
            value={newCategory}
            onChange={(e) =>
              setNewCategory(e.target.value as IngredientCategory)
            }
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {INGREDIENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {catalogAdmin && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={addAsCatalog}
              onChange={(e) => setAddAsCatalog(e.target.checked)}
              className="rounded border-stone-300 text-brand-600 focus:ring-brand-500/30"
            />
            <span>Add to shared catalog (visible to all users)</span>
          </label>
        )}

        {/* Aliases */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">Aliases:</span>
          {newAliases.map((alias, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600"
            >
              {alias}
              <button
                type="button"
                onClick={() =>
                  setNewAliases((prev) => prev.filter((_, j) => j !== i))
                }
                className="ml-0.5 hover:text-red-500"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Add alias..."
              value={newAliasInput}
              onChange={(e) => setNewAliasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAlias();
                }
              }}
              className="w-32 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={handleAddAlias}
              className="rounded p-1 text-stone-400 hover:text-brand-600 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!newName.trim() || submitting}>
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Plus size={16} />
            )}
            {submitting ? "Adding..." : "Add Ingredient"}
          </Button>
        </div>
      </form>

      {/* Ingredient list grouped by category */}
      {categoryKeys.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">
              {searchQuery
                ? `${filteredIngredients.length} of ${ingredients.length} ingredient${ingredients.length !== 1 ? "s" : ""}`
                : `${ingredients.length} ingredient${ingredients.length !== 1 ? "s" : ""}`}
            </span>
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
            >
              {allCollapsed ? (
                <>
                  <ChevronsUpDown size={14} /> Expand all
                </>
              ) : (
                <>
                  <ChevronsDownUp size={14} /> Collapse all
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
                      editingId === item.id && editState ? (
                        <div
                          key={item.id}
                          className="space-y-3 rounded-lg border-2 border-brand-300 bg-brand-50/30 px-4 py-3"
                        >
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={editState.name}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s ? { ...s, name: e.target.value } : s
                                )
                              }
                              placeholder="Name (English)"
                              className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              autoFocus
                            />
                            <input
                              value={editState.nameGr}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s ? { ...s, nameGr: e.target.value } : s
                                )
                              }
                              placeholder="Name (Greek)"
                              className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                            <select
                              value={editState.category}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s
                                    ? {
                                        ...s,
                                        category:
                                          e.target.value as IngredientCategory,
                                      }
                                    : s
                                )
                              }
                              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            >
                              {INGREDIENT_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Edit aliases */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-stone-500">
                              Aliases:
                            </span>
                            {editState.aliases.map((alias, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600"
                              >
                                {alias}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditState((s) =>
                                      s
                                        ? {
                                            ...s,
                                            aliases: s.aliases.filter(
                                              (_, j) => j !== i
                                            ),
                                          }
                                        : s
                                    )
                                  }
                                  className="ml-0.5 hover:text-red-500"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Add alias..."
                                value={editState.aliasInput}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s
                                      ? { ...s, aliasInput: e.target.value }
                                      : s
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleEditAddAlias();
                                  }
                                }}
                                className="w-32 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              />
                              <button
                                type="button"
                                onClick={handleEditAddAlias}
                                className="rounded p-1 text-stone-400 hover:text-brand-600 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(item)}
                              disabled={!editState.name.trim() || saving}
                              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                            >
                              {saving && <Spinner className="h-3 w-3" />}
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
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.isCatalog && (
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                                  Catalog
                                </span>
                              )}
                              <span className="text-sm font-medium text-stone-800">
                                {item.name}
                              </span>
                              {item.nameGr && (
                                <span className="text-sm italic text-stone-400">
                                  ({item.nameGr})
                                </span>
                              )}
                            </div>
                            {item.aliases.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {item.aliases.map((alias, i) => (
                                  <span
                                    key={i}
                                    className="rounded bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400"
                                  >
                                    {alias}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {pantryIds.has(
                              ingredientLinkKey(item.id, masterScopeFromMasterIngredient(item))!
                            ) ? (
                              <span
                                className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600"
                                title="In pantry"
                              >
                                <Check size={10} />
                                {addedToPantry.has(
                                  ingredientLinkKey(item.id, masterScopeFromMasterIngredient(item))!
                                )
                                  ? "Added"
                                  : "In pantry"}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddToPantry(item)}
                                className="flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
                                title="Add to pantry"
                              >
                                <Package size={10} />
                                Pantry
                              </button>
                            )}
                            {(!item.isCatalog || catalogAdmin) && (
                              <>
                                <button
                                  onClick={() => startEditing(item)}
                                  className="p-1 text-stone-400 hover:text-brand-600 transition-colors"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      id: item.id,
                                      isCatalog: !!item.isCatalog,
                                    })
                                  }
                                  className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Egg size={48} />}
          title="No ingredients yet"
          description="Build your master ingredient list. Recipes and pantry items will link to these for accurate matching."
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ingredient"
        message="Are you sure? Existing recipes and pantry items that reference this ingredient will fall back to text matching."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!duplicateMatch}
        title="Possible duplicate"
        message={
          duplicateMatch
            ? `"${duplicateMatch.name}"${duplicateMatch.nameGr ? ` (${duplicateMatch.nameGr})` : ""} already exists in the catalog under ${duplicateMatch.category}. Add it anyway?`
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
    </div>
  );
}
