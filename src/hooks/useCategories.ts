import { useCallback, useEffect, useState } from "react";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/firestore";
import type { Category } from "@/types/category";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch {
      // Silently fail — categories are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (name: string, icon: string, description: string = "") => {
    const id = await createCategory(name, icon, description);
    setCategories((prev) =>
      [...prev, { id, name, icon, description }].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    return id;
  };

  const edit = async (id: string, data: Partial<Omit<Category, "id">>) => {
    await updateCategory(id, data);
    setCategories((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, ...data } : c))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return { categories, loading, add, edit, remove, refresh: load };
}
