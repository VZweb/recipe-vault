import { useState } from "react";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagChip } from "@/components/ui/TagChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TAG_COLORS } from "@/types/tag";

export function TagsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { tags, add, update, remove } = useTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await add(newName.trim(), newColor);
    setNewName("");
    setNewColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const startEdit = (tag: { id: string; name: string; color: string }) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditColor("");
  };

  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return;
    const original = tags.find((t) => t.id === editId);
    const fields: { name?: string; color?: string } = {};
    if (original && editName.trim() !== original.name) fields.name = editName.trim();
    if (original && editColor !== original.color) fields.color = editColor;
    if (Object.keys(fields).length > 0) await update(editId, fields);
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      {!embedded && <h1 className="text-2xl font-bold text-stone-800">Tags</h1>}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-col sm:flex-row gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <div className="flex-1">
          <Input
            placeholder="Tag name (e.g., Chicken, Quick, Greek)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
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
                style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
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

      {/* Tag list */}
      {tags.length > 0 ? (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3"
            >
              {editId === tag.id ? (
                <>
                  <div className="flex flex-1 items-center gap-3">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="max-w-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleUpdate();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <div className="flex gap-1.5">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`h-6 w-6 rounded-full transition-all ${
                            editColor === c
                              ? "ring-2 ring-offset-1 scale-110"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
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
                      className="h-3 w-3 rounded-full"
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
