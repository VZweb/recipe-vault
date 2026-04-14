import { useCallback, useEffect, useState } from "react";
import { fetchTags, createTag, deleteTag } from "@/lib/firestore";
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

  const add = async (name: string, color: string) => {
    const id = await createTag(name, color);
    setTags((prev) => [...prev, { id, name, color }].sort((a, b) => a.name.localeCompare(b.name)));
    return id;
  };

  const remove = async (id: string) => {
    await deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  return { tags, loading, add, remove, refresh: load };
}
