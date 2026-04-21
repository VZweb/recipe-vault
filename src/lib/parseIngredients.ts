import { normalizeText } from "./normalize";
import type { MasterIngredient } from "@/types/ingredient";
import type { Ingredient } from "@/types/recipe";

const QUANTITY_RE =
  /^(\d[\d./\s½¼¾⅓⅔⅛-]*)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|litres?|pieces?|cloves?|pinch|bunch|handful|can|cans|packets?|slices?|sticks?|large|medium|small|whole|γρ\.?|κ\.σ\.?|κ\.γ\.?|φλ\.?|τεμ\.?|λ\.?|κιλ[οό]\.?|μερίδες|ματσάκι[α]?|κλωνάρι[α]?|φέτ[αε]ς?|κομμάτι[α]?|κουτ[ιί]\.?|πακέτ[οα]\.?|μπουκάλι[α]?|δόσεις?|σακουλ[αά]κι[α]?)?\s+/i;

const GREEK_UNIT_MAP: Record<string, string> = {
  "γρ": "g", "γρ.": "g",
  "κ.σ": "tbsp", "κ.σ.": "tbsp",
  "κ.γ": "tsp", "κ.γ.": "tsp",
  "φλ": "cups", "φλ.": "cups",
  "τεμ": "pcs", "τεμ.": "pcs",
  "λ": "L", "λ.": "L",
  "κιλο": "kg", "κιλό": "kg", "κιλο.": "kg", "κιλό.": "kg",
  "ματσάκι": "bunch", "ματσάκια": "bunch",
  "κλωνάρι": "pcs", "κλωνάρια": "pcs",
  "φέτα": "slices", "φέτες": "slices",
  "κομμάτι": "pcs", "κομμάτια": "pcs",
  "κουτί": "can", "κουτι": "can", "κουτί.": "can", "κουτι.": "can",
  "πακέτο": "pack", "πακέτα": "pack", "πακετο": "pack", "πακετο.": "pack",
  "μπουκάλι": "bottle", "μπουκάλια": "bottle",
  "δόση": "pcs", "δόσεις": "pcs",
  "σακουλάκι": "bag", "σακουλάκια": "bag", "σακουλακι": "bag", "σακουλακια": "bag",
  "μερίδες": "pcs",
};

const GREEK_UNIT_PREFIX_RE =
  /^(κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?|σκ\.?)\s+/i;

const PAREN_QTY_RE =
  /^\((?:about\s+)?([\d.]+)\s*(ml|g|kg|oz|lb|lbs|cups?|tbsp|tsp)?\)\s*/i;

const SECTION_RE =
  /^(?:for\s+the|για\s+τ[οηα]\w?\s+)/i;

const SECTION_HEADER_KEYWORDS = [
  "ingredients", "what you need", "you will need", "shopping list",
  "συστατικά", "υλικά",
];

function normalizeUnit(raw: string): string {
  return GREEK_UNIT_MAP[raw.toLowerCase()] || raw;
}

function cleanIngredientName(name: string): string {
  return name
    .replace(/^(?:κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|σκ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?)\s*/i, "")
    .replace(/^\([\d.,-]+\s*(?:ounce|oz|pound|lb|quart|cup|pint)s?\)\s*/i, "")
    .replace(/\(\$[\d.]+\)/g, "")
    .replace(/\((?:about\s+)?[\d.]+\s*(?:ml|g|kg|oz|lb|lbs|liters?|litres?)\.?(?:\s+total)?\)/gi, "")
    .replace(/(?:^|\s)κτψ\.?(?:\s|$)/gi, " ")
    .replace(/(?:^|\s)κατεψυγμέν[οηα](?:\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantity(qtyStr: string): number | null {
  try {
    const result = qtyStr
      .replace("½", ".5")
      .replace("¼", ".25")
      .replace("¾", ".75")
      .replace("⅓", ".333")
      .replace("⅔", ".667")
      .replace("⅛", ".125")
      .split(/\s+/)
      .reduce((sum, part) => {
        if (part.includes("/")) {
          const [n, d] = part.split("/");
          return sum + Number(n) / Number(d);
        }
        return sum + Number(part);
      }, 0);
    return isNaN(result) ? null : result;
  } catch {
    return null;
  }
}

function extractNote(name: string): { cleaned: string; note: string } {
  const parenMatch = name.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      cleaned: name.slice(0, parenMatch.index!).trim(),
      note: parenMatch[1]!.trim(),
    };
  }
  const commaIdx = name.indexOf(",");
  if (commaIdx > 0) {
    return {
      cleaned: name.slice(0, commaIdx).trim(),
      note: name.slice(commaIdx + 1).trim(),
    };
  }
  return { cleaned: name, note: "" };
}

function looksLikeSection(line: string): boolean {
  const stripped = line.replace(/^[-•*#]+\s*/, "").replace(/[:#]+$/, "").trim();
  const lower = stripped.toLowerCase();
  if (SECTION_HEADER_KEYWORDS.some((k) => lower === k || lower.startsWith(k))) return true;
  if (SECTION_RE.test(stripped)) return true;
  if (/^[A-ZΑ-Ω\s]+$/.test(stripped) && stripped.length > 2 && stripped.length < 60) return true;
  if (line.endsWith(":") && !QUANTITY_RE.test(line)) return true;
  return false;
}

function cleanSectionName(line: string): string {
  return line.replace(/^[-•*#]+\s*/, "").replace(/[:#]+$/, "").trim();
}

function parseLine(raw: string): { name: string; quantity: number | null; unit: string; note: string } {
  const clean = raw.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();

  const qtyMatch = clean.match(QUANTITY_RE);
  if (qtyMatch) {
    const qtyStr = qtyMatch[1]!.trim();
    const rawUnit = (qtyMatch[2] ?? "").trim();
    const unit = normalizeUnit(rawUnit);
    const rest = cleanIngredientName(clean.slice(qtyMatch[0].length));
    const { cleaned, note } = extractNote(rest);
    return { name: cleaned || clean, quantity: parseQuantity(qtyStr), unit, note };
  }

  const parenMatch = clean.match(PAREN_QTY_RE);
  if (parenMatch) {
    const quantity = parseQuantity(parenMatch[1]!);
    const unit = parenMatch[2] ? normalizeUnit(parenMatch[2]) : "";
    const rest = cleanIngredientName(clean.slice(parenMatch[0].length));
    const { cleaned, note } = extractNote(rest);
    return { name: cleaned || clean, quantity, unit, note };
  }

  const unitMatch = clean.match(GREEK_UNIT_PREFIX_RE);
  if (unitMatch) {
    const rawUnit = unitMatch[1]!.replace(/\.$/, "").trim();
    const unit = normalizeUnit(rawUnit);
    const rest = cleanIngredientName(clean.slice(unitMatch[0].length));
    const { cleaned, note } = extractNote(rest);
    return { name: cleaned || clean, quantity: null, unit, note };
  }

  const rest = cleanIngredientName(clean);
  const { cleaned, note } = extractNote(rest);
  return { name: cleaned || clean, quantity: null, unit: "", note };
}

function findCatalogMatch(
  rawName: string,
  catalog: MasterIngredient[],
): MasterIngredient | null {
  const norm = normalizeText(rawName);
  if (!norm) return null;

  let bestMatch: MasterIngredient | null = null;
  let bestScore = 0;

  for (const mi of catalog) {
    const targets = [
      normalizeText(mi.name),
      normalizeText(mi.nameGr),
      ...mi.aliases.map(normalizeText),
    ].filter(Boolean);

    for (const t of targets) {
      if (t === norm) return mi; // exact match — return immediately
      if (norm.includes(t) && t.length > bestScore) {
        bestMatch = mi;
        bestScore = t.length;
      }
      if (t.includes(norm) && norm.length > bestScore) {
        bestMatch = mi;
        bestScore = norm.length;
      }
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

export function parseIngredientText(
  text: string,
  catalog: MasterIngredient[],
  startSortOrder: number,
): Ingredient[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const results: Ingredient[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const sortOrder = startSortOrder + i;

    if (looksLikeSection(line)) {
      const sectionName = cleanSectionName(line);
      if (SECTION_HEADER_KEYWORDS.some((k) => sectionName.toLowerCase() === k))
        continue; // skip generic "Ingredients" headers
      results.push({
        name: sectionName,
        nameSecondary: "",
        quantity: null,
        unit: "",
        sortOrder,
        masterIngredientId: null,
        masterIngredientScope: null,
        note: "",
        isSection: true,
      });
      continue;
    }

    const parsed = parseLine(line);
    const match = findCatalogMatch(parsed.name, catalog);

    results.push({
      name: match?.name ?? parsed.name,
      nameSecondary: match?.nameGr ?? "",
      quantity: parsed.quantity,
      unit: parsed.unit,
      sortOrder,
      masterIngredientId: match?.id ?? null,
      masterIngredientScope: match
        ? match.isCatalog === false
          ? "custom"
          : "catalog"
        : null,
      note: parsed.note,
      isSection: false,
    });
  }

  return results.map((ing, i) => ({ ...ing, sortOrder: startSortOrder + i }));
}
