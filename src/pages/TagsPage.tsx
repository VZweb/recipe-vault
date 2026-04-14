import { useState } from "react";
import { Palette, Plus, Tags, Trash2 } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagChip } from "@/components/ui/TagChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TAG_COLORS } from "@/types/tag";

export function TagsPage() {
  const { tags, add, remove } = useTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Tags</h1>

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
                style={{ backgroundColor: c, ringColor: c }}
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
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <TagChip name={tag.name} color={tag.color} />
              </div>
              <button
                onClick={() => setDeleteId(tag.id)}
                className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 size={16} />
              </button>
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
