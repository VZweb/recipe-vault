import { useCallback, useEffect, useState } from "react";
import {
  fetchMasterIngredients,
  addMasterIngredient,
  updateMasterIngredient,
  deleteMasterIngredient,
} from "@/lib/firestore";
import type { MasterIngredient } from "@/types/ingredient";

export function useIngredients() {
  const [ingredients, setIngredients] = useState<MasterIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMasterIngredients();
      setIngredients(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (item: Omit<MasterIngredient, "id">) => {
    const id = await addMasterIngredient(item);
    const newItem: MasterIngredient = { id, ...item };
    setIngredients((prev) =>
      [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
    );
    return id;
  };

  const update = async (
    id: string,
    data: Partial<Omit<MasterIngredient, "id">>
  ) => {
    await updateMasterIngredient(id, data);
    setIngredients((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, ...data } : i))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const remove = async (id: string) => {
    await deleteMasterIngredient(id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  return { ingredients, loading, add, update, remove, refresh: load };
}
