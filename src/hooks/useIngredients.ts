import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMasterIngredients,
  addMasterIngredient,
  addCatalogMasterIngredient,
  updateMasterIngredient,
  deleteMasterIngredient,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, REFERENCE_DATA_STALE_MS } from "@/lib/queryKeys";
import type { MasterIngredient } from "@/types/ingredient";

export function useIngredients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? "";

  const { data: ingredients = [], isPending: loading, refetch } = useQuery({
    queryKey: queryKeys.masterIngredients(uid),
    queryFn: async (): Promise<MasterIngredient[]> => {
      try {
        return await fetchMasterIngredients();
      } catch {
        return [];
      }
    },
    enabled: !!user,
    staleTime: REFERENCE_DATA_STALE_MS,
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  const add = async (item: Omit<MasterIngredient, "id" | "isCatalog">) => {
    const id = await addMasterIngredient(item);
    const newItem: MasterIngredient = { id, ...item, isCatalog: false };
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients(uid),
      (prev = []) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
    );
    return id;
  };

  const addCatalog = async (item: Omit<MasterIngredient, "id" | "isCatalog">) => {
    const id = await addCatalogMasterIngredient(item);
    const newItem: MasterIngredient = { id, ...item, isCatalog: true };
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients(uid),
      (prev = []) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
    );
    return id;
  };

  const update = async (
    id: string,
    data: Partial<Omit<MasterIngredient, "id" | "isCatalog">>
  ) => {
    await updateMasterIngredient(id, data);
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients(uid),
      (prev = []) =>
        prev
          .map((i) => (i.id === id ? { ...i, ...data } : i))
          .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteMasterIngredient(id);
    queryClient.setQueryData<MasterIngredient[]>(
      queryKeys.masterIngredients(uid),
      (prev = []) => prev.filter((i) => i.id !== id)
    );
  };

  return { ingredients, loading, add, addCatalog, update, remove, refresh };
}
