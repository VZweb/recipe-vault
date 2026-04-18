import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagChip } from "@/components/ui/TagChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TAG_COLORS, TAG_CATEGORIES } from "@/types/tag";

export function TagsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { tags, add, update, remove } = useTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[0]);
  const [newCategory, setNewCategory] = useState<string>(TAG_CATEGORIES[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const groupedTags = useMemo(() => {
    const groups = new Map<string, typeof tags>();
    for (const cat of TAG_CATEGORIES) {
      groups.set(cat, []);
    }
    for (const tag of tags) {
      const bucket = groups.get(tag.category) ?? groups.get("Other")!;
      bucket.push(tag);
    }
    return [...groups.entries()].filter(([, items]) => items.length > 0);
  }, [tags]);

  const toggleGroup = (cat: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await add(newName.trim(), newColor, newCategory);
    setNewName("");
    setNewColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const startEdit = (tag: {
    id: string;
    name: string;
    color: string;
    category: string;
  }) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditCategory(tag.category);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditColor("");
    setEditCategory("");
  };

  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return;
    const original = tags.find((t) => t.id === editId);
    const fields: { name?: string; color?: string; category?: string } = {};
    if (original && editName.trim() !== original.name)
      fields.name = editName.trim();
    if (original && editColor !== original.color) fields.color = editColor;
    if (original && editCategory !== original.category)
      fields.category = editCategory;
    if (Object.keys(fields).length > 0) await update(editId, fields);
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <h1 className="text-2xl font-bold text-stone-800">Tags</h1>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Tag name (e.g., Chicken, Quick, Greek)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          >
            {TAG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${
                  newColor === c
                    ? "ring-2 ring-offset-2 scale-110"
                    : "hover:scale-105"
                }`}
                style={{
                  backgroundColor: c,
                  ["--tw-ring-color" as string]: c,
                }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <Button type="submit" disabled={!newName.trim()}>
            <Plus size={16} />
            Add
          </Button>
        </div>
      </form>

      {/* Grouped tag list */}
      {tags.length > 0 ? (
        <div className="space-y-4">
          {groupedTags.map(([category, items]) => {
            const collapsed = collapsedGroups.has(category);
            return (
              <div
                key={category}
                className="rounded-xl border border-stone-200 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(category)}
                  className="flex w-full items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {collapsed ? (
                      <ChevronRight size={16} className="text-stone-400" />
                    ) : (
                      <ChevronDown size={16} className="text-stone-400" />
                    )}
                    <span className="font-semibold text-stone-700">
                      {category}
                    </span>
                    <span className="text-xs text-stone-400">
                      {items.length}
                    </span>
                  </div>
                </button>

                {!collapsed && (
                  <div className="border-t border-stone-100 divide-y divide-stone-100">
                    {items.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        {editId === tag.id ? (
                          <>
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="max-w-[180px]"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleUpdate();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <select
                                value={editCategory}
                                onChange={(e) =>
                                  setEditCategory(e.target.value)
                                }
                                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
                              >
                                {TAG_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-1">
                                {TAG_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditColor(c)}
                                    className={`h-5 w-5 rounded-full transition-all ${
                                      editColor === c
                                        ? "ring-2 ring-offset-1 scale-110"
                                        : "hover:scale-105"
                                    }`}
                                    style={{
                                      backgroundColor: c,
                                      ["--tw-ring-color" as string]: c,
                                    }}
                                    aria-label={`Select color ${c}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => void handleUpdate()}
                                disabled={!editName.trim()}
                                className="p-1 text-green-600 hover:text-green-700 transition-colors disabled:opacity-40"
                                aria-label="Save"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                                aria-label="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-3 w-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                              <TagChip name={tag.name} color={tag.color} />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEdit(tag)}
                                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                                aria-label={`Edit ${tag.name}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteId(tag.id)}
                                className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                                aria-label={`Delete ${tag.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Tags size={48} />}
          title="No tags yet"
          description="Tags help you organize and filter your recipes. Create your first tag above."
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete tag"
        message="Are you sure? This will remove the tag but won't delete any recipes."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
