/**
 * Greek-aware text normalization for ingredient matching.
 * Strips accents/diacritics, folds final sigma, collapses whitespace.
 */
export function normalizeText(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      // Strip accents: ά→α, ή→η, ΐ→ι, etc.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Fold final sigma: ς→σ
      .replace(/ς/g, "σ")
      .replace(/\s+/g, " ")
  );
}
