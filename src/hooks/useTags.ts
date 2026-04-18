import { useCallback, useEffect, useState } from "react";
import { fetchTags, createTag, updateTag, deleteTag } from "@/lib/firestore";
import type { Tag } from "@/types/tag";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTags();
      setTags(data);
    } catch {
      // Silently fail — tags are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (name: string, color: string, category: string = "Other") => {
    const id = await createTag(name, color, category);
    setTags((prev) => [...prev, { id, name, color, category }].sort((a, b) => a.name.localeCompare(b.name)));
    return id;
  };

  const update = async (id: string, fields: { name?: string; color?: string; category?: string }) => {
    await updateTag(id, fields);
    setTags((prev) =>
      prev
        .map((t) => (t.id === id ? { ...t, ...fields } : t))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  return { tags, loading, add, update, remove, refresh: load };
}
