import { useState } from "react";
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  CategoryIcon,
  CATEGORY_ICON_OPTIONS,
} from "@/components/ui/CategoryIcon";
import type { Category } from "@/types/category";

interface EditState {
  name: string;
  description: string;
  icon: string;
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CATEGORY_ICON_OPTIONS.map((iconKey) => (
        <button
          key={iconKey}
          type="button"
          onClick={() => onChange(iconKey)}
          className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
            value === iconKey
              ? "bg-brand-100 text-brand-700 ring-2 ring-brand-400 ring-offset-1 scale-110"
              : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700 hover:scale-105"
          }`}
          aria-label={`Select icon ${iconKey}`}
        >
          <CategoryIcon icon={iconKey} size={16} />
        </button>
      ))}
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (id: string, data: Partial<Omit<Category, "id">>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditState>({
    name: category.name,
    description: category.description,
    icon: category.icon,
  });

  const startEditing = () => {
    setForm({
      name: category.name,
      description: category.description,
      icon: category.icon,
    });
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onEdit(category.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4 space-y-3">
        <div className="flex gap-3">
          <Input
            placeholder="Category name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="flex-1"
          />
        </div>
        <input
          type="text"
          placeholder="Short description (optional)"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
        />
        <IconPicker
          value={form.icon}
          onChange={(icon) => setForm((f) => ({ ...f, icon }))}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelEditing}
          >
            <X size={14} />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!form.name.trim() || saving}
            onClick={handleSave}
          >
            <Check size={14} />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center h-8 w-8 flex-shrink-0 rounded-lg bg-brand-50 text-brand-600">
          <CategoryIcon icon={category.icon} size={18} />
        </div>
        <div className="min-w-0">
          <span className="font-medium text-stone-800">{category.name}</span>
          {category.description && (
            <p className="text-xs text-stone-500 truncate">
              {category.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={startEditing}
          className="p-1.5 text-stone-400 hover:text-brand-600 transition-colors"
          aria-label={`Edit ${category.name}`}
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export function CategoriesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { categories, add, edit, remove } = useCategories();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("utensils");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await add(newName.trim(), newIcon, newDescription.trim());
    setNewName("");
    setNewDescription("");
    setNewIcon("utensils");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {!embedded && <h1 className="text-2xl font-bold text-stone-800">Categories</h1>}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Category name (e.g., Pasta, Salad, Soup)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Short description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <IconPicker
            value={newIcon}
            onChange={(icon) => setNewIcon(icon)}
          />
          <Button type="submit" disabled={!newName.trim()} className="flex-shrink-0">
            <Plus size={16} />
            Add
          </Button>
        </div>
      </form>

      {/* Category list */}
      {categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={edit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen size={48} />}
          title="No categories yet"
          description="Categories help you organize recipes by dish type. Create your first category above."
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete category"
        message="Are you sure? Recipes in this category will become uncategorized."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
