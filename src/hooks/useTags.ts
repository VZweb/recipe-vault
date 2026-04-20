import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTags, createTag, updateTag, deleteTag } from "@/lib/firestore";
import { queryKeys, REFERENCE_DATA_STALE_MS } from "@/lib/queryKeys";
import type { Tag } from "@/types/tag";

export function useTags() {
  const queryClient = useQueryClient();

  const { data: tags = [], isPending: loading, refetch } = useQuery({
    queryKey: queryKeys.tags,
    queryFn: async (): Promise<Tag[]> => {
      try {
        return await fetchTags();
      } catch {
        return [];
      }
    },
    staleTime: REFERENCE_DATA_STALE_MS,
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  const add = async (name: string, color: string, category: string = "Other") => {
    const id = await createTag(name, color, category);
    queryClient.setQueryData<Tag[]>(queryKeys.tags, (prev = []) =>
      [...prev, { id, name, color, category }].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    return id;
  };

  const update = async (
    id: string,
    fields: { name?: string; color?: string; category?: string }
  ) => {
    await updateTag(id, fields);
    queryClient.setQueryData<Tag[]>(queryKeys.tags, (prev = []) =>
      prev
        .map((t) => (t.id === id ? { ...t, ...fields } : t))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteTag(id);
    queryClient.setQueryData<Tag[]>(queryKeys.tags, (prev = []) =>
      prev.filter((t) => t.id !== id)
    );
  };

  return { tags, loading, add, update, remove, refresh };
}
