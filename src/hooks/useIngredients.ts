import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMasterIngredients,
  addMasterIngredient,
  updateMasterIngredient,
  deleteMasterIngredient,
} from "@/lib/firestore";
import { queryKeys, REFERENCE_DATA_STALE_MS } from "@/lib/queryKeys";
import type { MasterIngredient } from "@/types/ingredient";

export function useIngredients() {
  const queryClient = useQueryClient();

  const { data: ingredients = [], isPending: loading, refetch } = useQuery({
    queryKey: queryKeys.masterIngredients,
    queryFn: async (): Promise<MasterIngredient[]> => {
      try {
        return await fetchMasterIngredients();
      } catch {
        return [];
      }
    },
    staleTime: REFERENCE_DATA_STALE_MS,
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  const add = async (item: Omit<MasterIngredient, "id">) => {
    const id = await addMasterIngredient(item);
    const newItem: MasterIngredient = { id, ...item };
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients,
      (prev = []) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
    );
    return id;
  };

  const update = async (
    id: string,
    data: Partial<Omit<MasterIngredient, "id">>
  ) => {
    await updateMasterIngredient(id, data);
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients,
      (prev = []) =>
        prev
          .map((i) => (i.id === id ? { ...i, ...data } : i))
          .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteMasterIngredient(id);
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients,
      (prev = []) => prev.filter((i) => i.id !== id)
    );
  };

  return { ingredients, loading, add, update, remove, refresh };
}
