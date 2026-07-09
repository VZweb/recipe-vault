import type { MasterIngredient } from "@/types/ingredient";
import type { PantryItem } from "@/types/pantry";
import { PANTRY_CATEGORIES } from "@/types/pantry";
import type { Ingredient, RecipeFormData, Step } from "@/types/recipe";
import { linkIngredientToCatalog } from "./parseIngredients";
import { parseStepsText } from "./parseSteps";

const RECIPE_VAULT_FENCE_RE = /```recipe-vault\s*([\s\S]*?)```/i;
const JSON_FENCE_RE = /```json\s*([\s\S]*?)```/gi;

export interface ImportedRecipeIngredientDto {
  name: string;
  quantity?: number | string | null;
  unit?: string;
  note?: string;
  isSection?: boolean;
}

export interface ImportedRecipeDto {
  title: string;
  description?: string;
  servings?: number | string | null;
  prepTimeMin?: number | string | null;
  cookTimeMin?: number | string | null;
  notes?: string;
  /** Direct HTTPS image URLs (or a single `imageUrl` string). */
  imageUrls?: string[] | string;
  imageUrl?: string;
  ingredients?: ImportedRecipeIngredientDto[];
  steps?: string[];
}

export interface ParseImportedRecipeResult {
  data: RecipeFormData;
  warnings: string[];
}

interface ExtraIngredientInput {
  name: string;
}

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(String(value).trim());
  return Number.isNaN(n) ? null : n;
}

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeImageUrls(
  dto: ImportedRecipeDto,
  warnings: string[],
): string[] {
  const raw: string[] = [];
  if (typeof dto.imageUrl === "string" && dto.imageUrl.trim()) {
    raw.push(dto.imageUrl.trim());
  }
  if (typeof dto.imageUrls === "string" && dto.imageUrls.trim()) {
    raw.push(dto.imageUrls.trim());
  } else if (Array.isArray(dto.imageUrls)) {
    for (const item of dto.imageUrls) {
      if (typeof item === "string" && item.trim()) raw.push(item.trim());
    }
  }

  const valid = raw.filter(isValidImageUrl);
  const skipped = raw.length - valid.length;
  if (skipped > 0) {
    warnings.push(
      `${skipped} image URL${skipped > 1 ? "s were" : " was"} invalid and skipped.`,
    );
  }
  return valid;
}

function extractJsonPayload(text: string): string {
  const vaultMatch = text.match(RECIPE_VAULT_FENCE_RE);
  if (vaultMatch?.[1]) return vaultMatch[1].trim();

  for (const match of text.matchAll(JSON_FENCE_RE)) {
    const body = match[1]?.trim() ?? "";
    if (body.includes('"title"') && body.includes('"ingredients"')) {
      return body;
    }
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  throw new Error(
    "Could not find a recipe-vault block. Copy the full ChatGPT reply or check the JSON.",
  );
}

function mapIngredientDto(
  dto: ImportedRecipeIngredientDto,
  sortOrder: number,
  catalog: MasterIngredient[],
): Ingredient {
  if (dto.isSection) {
    return {
      name: dto.name.trim(),
      nameSecondary: "",
      quantity: null,
      unit: "",
      sortOrder,
      masterIngredientId: null,
      masterIngredientScope: null,
      substituteLinks: [],
      note: "",
      isSection: true,
    };
  }

  const linked = linkIngredientToCatalog(dto.name.trim(), catalog);
  return {
    ...linked,
    quantity: coerceNumber(dto.quantity),
    unit: dto.unit?.trim() ?? "",
    sortOrder,
    substituteLinks: [],
    note: dto.note?.trim() ?? "",
    isSection: false,
  };
}

function mapSteps(steps: string[] | undefined): Step[] {
  if (!steps || steps.length === 0) {
    return [{ instruction: "", imageUrl: null, sortOrder: 0 }];
  }
  return parseStepsText(steps.join("\n"), 0);
}

export function parseImportedRecipeText(
  text: string,
  catalog: MasterIngredient[],
): ParseImportedRecipeResult {
  const warnings: string[] = [];
  const jsonStr = extractJsonPayload(text);
  let dto: ImportedRecipeDto;
  try {
    dto = JSON.parse(jsonStr) as ImportedRecipeDto;
  } catch {
    throw new Error(
      "Invalid JSON in recipe-vault block. Ask ChatGPT to fix the import block.",
    );
  }

  const title = dto.title?.trim();
  if (!title) {
    throw new Error("Imported recipe is missing a title.");
  }

  const ingredientDtos = dto.ingredients ?? [];
  const stepStrings = dto.steps ?? [];

  if (ingredientDtos.length === 0 && stepStrings.length === 0) {
    throw new Error("Imported recipe must include ingredients or steps.");
  }

  const ingredients = ingredientDtos.map((item, i) =>
    mapIngredientDto(item, i, catalog),
  );

  const unlinked = ingredients.filter(
    (i) => !i.isSection && !i.masterIngredientId,
  ).length;
  if (unlinked > 0) {
    warnings.push(
      `${unlinked} ingredient${unlinked > 1 ? "s" : ""} not linked to the catalog — you can fix them in the editor.`,
    );
  }

  const imageUrls = normalizeImageUrls(dto, warnings);

  const data: RecipeFormData = {
    title,
    description: dto.description?.trim() ?? "",
    servings: coerceNumber(dto.servings),
    prepTimeMin: coerceNumber(dto.prepTimeMin),
    cookTimeMin: coerceNumber(dto.cookTimeMin),
    sourceUrl: "",
    videoUrl: "",
    imageUrls,
    categoryId: null,
    tags: [],
    ingredients:
      ingredients.length > 0
        ? ingredients
        : [
            {
              name: "",
              nameSecondary: "",
              quantity: null,
              unit: "",
              sortOrder: 0,
              masterIngredientId: null,
              masterIngredientScope: null,
              substituteLinks: [],
              note: "",
              isSection: false,
            },
          ],
    steps: mapSteps(stepStrings),
    notes: dto.notes?.trim() ?? "",
  };

  return { data, warnings };
}

export function buildChatGptRecipePrompt(
  pantryItems: PantryItem[],
  extraIngredients: ExtraIngredientInput[],
): string {
  const staples = pantryItems.filter((i) => i.isStaple);
  const regular = pantryItems.filter((i) => !i.isStaple);

  const formatItem = (item: PantryItem) => {
    let s = item.name;
    if (item.quantity != null || item.unit) {
      const parts = [item.quantity?.toString(), item.unit].filter(Boolean).join(" ");
      s += ` (${parts})`;
    }
    return s;
  };

  const byCategory = PANTRY_CATEGORIES.reduce(
    (acc, cat) => {
      const catItems = regular.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    },
    {} as Record<string, PantryItem[]>,
  );

  const lines: string[] = [
    "I have the following ingredients in my pantry:",
    "",
  ];

  for (const [cat, catItems] of Object.entries(byCategory)) {
    lines.push(`${cat}: ${catItems.map(formatItem).join(", ")}`);
  }

  if (extraIngredients.length > 0) {
    lines.push("");
    lines.push(
      `Extra ingredients I also have: ${extraIngredients.map((e) => e.name).join(", ")}`,
    );
  }

  if (staples.length > 0) {
    lines.push("");
    lines.push(`Staples (always available): ${staples.map(formatItem).join(", ")}`);
  }

  lines.push("");
  lines.push("Suggest 1 recipe I can make with these ingredients.");
  lines.push("");
  lines.push("Format your answer in two parts:");
  lines.push("1. A short human-readable recipe (title, ingredients, steps).");
  lines.push(
    "2. At the very end, a machine-readable import block wrapped exactly like this:",
  );
  lines.push("");
  lines.push("Include an `imageUrls` array with one direct HTTPS image URL of the finished dish. Use a direct link to a .jpg or .png file, not a webpage.");
  lines.push("");
  lines.push("```recipe-vault");
  lines.push(
    JSON.stringify(
      {
        title: "Example Pasta",
        description: "A quick weeknight pasta.",
        servings: 4,
        prepTimeMin: 10,
        cookTimeMin: 20,
        imageUrls: ["https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg"],
        ingredients: [
          { name: "pasta", quantity: 400, unit: "g" },
          { name: "For the sauce", isSection: true },
          { name: "tomato paste", quantity: 200, unit: "g" },
        ],
        steps: ["Boil the pasta.", "Simmer the sauce and combine."],
      },
      null,
      2,
    ),
  );
  lines.push("```");
  lines.push("");
  lines.push(
    "Use only valid JSON inside the fence. Do not include comments or trailing commas.",
  );

  return lines.join("\n");
}
