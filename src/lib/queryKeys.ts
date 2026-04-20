/** TanStack Query cache keys for server-backed data (expand in later phases). */
export const queryKeys = {
  tags: (uid: string) => ["tags", uid] as const,
  categories: (uid: string) => ["categories", uid] as const,
  masterIngredients: (uid: string) => ["masterIngredients", uid] as const,
};

/** How long tags, categories, and master ingredients stay “fresh” before background refetch is allowed. */
export const REFERENCE_DATA_STALE_MS = 5 * 60 * 1000;
