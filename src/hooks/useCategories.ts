import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, REFERENCE_DATA_STALE_MS } from "@/lib/queryKeys";
import type { Category } from "@/types/category";

export function useCategories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? "";

  const { data: categories = [], isPending: loading, refetch } = useQuery({
    queryKey: queryKeys.categories(uid),
    queryFn: async (): Promise<Category[]> => {
      try {
        return await fetchCategories();
      } catch {
        return [];
      }
    },
    enabled: !!user,
    staleTime: REFERENCE_DATA_STALE_MS,
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  const add = async (name: string, icon: string, description: string = "") => {
    const id = await createCategory(name, icon, description);
    queryClient.setQueryData<Category[]>(
      queryKeys.categories(uid),
      (prev = []) =>
        [...prev, { id, name, icon, description }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
    );
    return id;
  };

  const edit = async (id: string, data: Partial<Omit<Category, "id">>) => {
    await updateCategory(id, data);
    queryClient.setQueryData<Category[]>(
      queryKeys.categories(uid),
      (prev = []) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...data } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteCategory(id);
    queryClient.setQueryData<Category[]>(
      queryKeys.categories(uid),
      (prev = []) => prev.filter((c) => c.id !== id)
    );
  };

  return { categories, loading, add, edit, remove, refresh };
}
