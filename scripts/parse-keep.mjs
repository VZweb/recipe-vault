#!/usr/bin/env node
/**
 * parse-keep.mjs
 *
 * Reads Google Keep exports (JSON or HTML, from Google Takeout) and produces
 * a reviewable JSON file that maps to the recipe-vault Recipe schema.
 *
 * Usage:
 *   node parse-keep.mjs <path-to-Keep-folder> [--output parsed-recipes.json]
 *
 * The Keep folder is the one inside the Takeout archive, e.g.  Takeout/Keep/
 * It contains one .json (or .html) file per note.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseHTML } from "node-html-parser";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help")) {
  console.log(`
Usage:
  node parse-keep.mjs <path-to-Keep-folder> [--output <file.json>]

Options:
  --output, -o   Output JSON path (default: parsed-recipes.json)
  --label, -l    Only include notes with this Google Keep label (can repeat)
                 Matching is case-insensitive and supports substring matching.
  --help         Show this help

Example:
  node parse-keep.mjs ~/Downloads/Takeout/Keep -l "1. Recipes" -o my-recipes.json
`);
  process.exit(0);
}

const keepDir = args[0];
const outputIdx = args.findIndex((a) => a === "--output" || a === "-o");
const outputPath =
  outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : "parsed-recipes.json";

const labelFilters = [];
args.forEach((a, i) => {
  if ((a === "--label" || a === "-l") && args[i + 1]) {
    labelFilters.push(args[i + 1].toLowerCase());
  }
});

if (!fs.existsSync(keepDir)) {
  console.error(`Error: folder not found: ${keepDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// JSON note extraction (primary format from Google Takeout)
// ---------------------------------------------------------------------------

function extractNoteFromJson(json) {
  if (json.isTrashed) return null;

  const title = (json.title || "").trim();

  // Labels come as [{name: "..."}, ...]
  const labels = (json.labels || []).map((l) => l.name || "").filter(Boolean);

  // Text content — plain text body
  let lines = [];
  if (json.textContent) {
    lines = json.textContent
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  // Checklist notes use listContent instead of textContent
  if (json.listContent && json.listContent.length > 0) {
    const checklistLines = json.listContent
      .map((item) => (item.text || "").trim())
      .filter(Boolean);
    lines = [...lines, ...checklistLines];
  }

  // Web-link annotations carry rich metadata
  const annotations = (json.annotations || []).filter(
    (a) => a.source === "WEBLINK"
  );

  // Timestamps (microseconds → ms)
  const createdAt = json.createdTimestampUsec
    ? new Date(json.createdTimestampUsec / 1000)
    : null;

  const isChecklist = !!(json.listContent && json.listContent.length > 0);

  return { title, lines, labels, annotations, createdAt, archived: !!json.isArchived, isChecklist };
}

// ---------------------------------------------------------------------------
// HTML note extraction (fallback for older exports)
// ---------------------------------------------------------------------------

function extractNoteFromHtml(htmlContent) {
  const root = parseHTML(htmlContent);

  const title =
    root.querySelector(".heading")?.text?.trim() ||
    root.querySelector("title")?.text?.trim() ||
    "";

  const contentEl = root.querySelector(".content");
  let lines = [];
  if (contentEl) {
    const listItems = contentEl.querySelectorAll("li");
    if (listItems.length > 0) {
      lines = listItems.map((li) => li.text.trim()).filter(Boolean);
    } else {
      lines = contentEl.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
  }

  const labelEls = root.querySelectorAll(".label-name, .label .label-name");
  let labels = labelEls.map((el) => el.text.trim()).filter(Boolean);
  if (labels.length === 0) {
    const chipEls = root.querySelectorAll(".chip .label, .chip");
    labels = chipEls.map((el) => el.text.trim()).filter(Boolean);
  }

  return { title, lines, labels, annotations: [], createdAt: null, archived: false };
}

// ---------------------------------------------------------------------------
// Recipe extraction heuristics
// ---------------------------------------------------------------------------

const QUANTITY_RE =
  /^(\d[\d./\s½¼¾⅓⅔⅛-]*)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|litres?|pieces?|cloves?|pinch|bunch|handful|can|cans|packets?|slices?|sticks?|large|medium|small|whole|γρ\.?|κ\.σ\.?|κ\.γ\.?|φλ\.?|τεμ\.?|λ\.?|κιλ[οό]\.?|μερίδες|ματσάκι[α]?|κλωνάρι[α]?|φέτ[αε]ς?|κομμάτι[α]?|κουτ[ιί]\.?|πακέτ[οα]\.?|μπουκάλι[α]?|δόσεις?|σακουλ[αά]κι[α]?)?\s+/i;

const SECTION_HEADERS_INGREDIENTS = [
  "ingredients",
  "what you need",
  "you will need",
  "shopping list",
  "συστατικά",
  "υλικά",
];
const SECTION_HEADERS_STEPS = [
  "instructions",
  "directions",
  "steps",
  "method",
  "preparation",
  "how to make",
  "εκτέλεση",
  "οδηγίες",
];

function isSectionHeader(line, headers) {
  const lower = line.toLowerCase().replace(/[:#\-*]/g, "").trim();
  return headers.some((h) => lower === h || lower.startsWith(h));
}

function looksLikeIngredient(line) {
  if (QUANTITY_RE.test(line)) return true;
  if (/^[-•*]\s/.test(line) && line.length < 80) return true;
  if (/^[-•*]?\s*\d/.test(line) && line.length < 80) return true;
  if (/^\([\d.]+\s*(?:ml|g|kg|oz|lb|lbs|cups?|tbsp|tsp)\)/i.test(line)) return true;
  if (/^(?:κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?|σκ\.?)\s/i.test(line) && line.length < 80) return true;
  return false;
}

// Greek unit abbreviation → normalized display form
const GREEK_UNIT_MAP = {
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

function normalizeUnit(raw) {
  const lower = raw.toLowerCase();
  return GREEK_UNIT_MAP[lower] || raw;
}

function cleanIngredientName(name) {
  return name
    // Strip Greek unit abbreviation prefixes (with or without trailing space)
    .replace(/^(?:κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|σκ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?)\s*/i, "")
    // Strip English unit-like prefixes that leak through: (15-ounce), (3 pound), (4 quarts)
    .replace(/^\([\d.,-]+\s*(?:ounce|oz|pound|lb|quart|cup|pint)s?\)\s*/i, "")
    // Strip cost annotations: ($5.25), ($0.10)
    .replace(/\(\$[\d.]+\)/g, "")
    // Strip parenthetical weight/volume duplicates: (30ml), (50g), (about 1.3 lb. total)
    .replace(/\((?:about\s+)?[\d.]+\s*(?:ml|g|kg|oz|lb|lbs|liters?|litres?)\.?(?:\s+total)?\)/gi, "")
    // Strip κτψ / κατεψυγμένο/η/ο (frozen abbreviation and full form)
    .replace(/(?:^|\s)κτψ\.?(?:\s|$)/gi, " ")
    .replace(/(?:^|\s)κατεψυγμέν[οηα](?:\s|$)/gi, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantity(qtyStr) {
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

// Greek unit abbreviation at start of line WITHOUT a leading digit
// e.g. "κ.σ. βασιλικό", "γρ. παρμεζάνα", "κλ. θυμάρι"
const GREEK_UNIT_PREFIX_RE =
  /^(κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?|σκ\.?)\s+/i;

// Parenthetical quantity at start: (50g), (32g), (about 1.3 lb)
const PAREN_QTY_RE =
  /^\((?:about\s+)?([\d.]+)\s*(ml|g|kg|oz|lb|lbs|cups?|tbsp|tsp)?\)\s*/i;

function parseIngredientLine(raw) {
  const clean = raw.replace(/^[-•*]\s*/, "").trim();

  // Priority 1: standard "2 cups flour" pattern
  const match = clean.match(QUANTITY_RE);
  if (match) {
    const qtyStr = match[1].trim();
    const rawUnit = (match[2] || "").trim();
    const unit = normalizeUnit(rawUnit);
    const name = cleanIngredientName(clean.slice(match[0].length));
    const quantity = parseQuantity(qtyStr);
    return { name: name || clean, quantity, unit };
  }

  // Priority 2: parenthetical quantity "(50g) scallions"
  const parenMatch = clean.match(PAREN_QTY_RE);
  if (parenMatch) {
    const quantity = parseQuantity(parenMatch[1]);
    const unit = parenMatch[2] ? normalizeUnit(parenMatch[2]) : "";
    const name = cleanIngredientName(clean.slice(parenMatch[0].length));
    return { name: name || clean, quantity, unit };
  }

  // Priority 3: Greek unit prefix without a digit ("κ.σ. βασιλικό")
  const unitMatch = clean.match(GREEK_UNIT_PREFIX_RE);
  if (unitMatch) {
    const rawUnit = unitMatch[1].replace(/\.$/, "").trim();
    const unit = normalizeUnit(rawUnit);
    const name = cleanIngredientName(clean.slice(unitMatch[0].length));
    return { name: name || clean, quantity: null, unit };
  }

  return { name: cleanIngredientName(clean), quantity: null, unit: "" };
}

const VIDEO_URL_RE = /(?:youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/i;

function isVideoUrl(url) {
  return VIDEO_URL_RE.test(url);
}

// Greek sub-section headers like "Για το κότσι", "Για τη σάλτσα", "Για τη γέμιση"
// These are ingredient group labels — skip them (app has no grouping support)
const SUB_SECTION_RE = /^για\s+τ[οηα]\w?\s+/i;

// Cook/prep time in title: (240'), (30 λεπτά), (45'), (1h30), (1.5h)
function extractTimeFromTitle(title) {
  let cookTimeMin = null;
  let cleanTitle = title;

  const match = title.match(/\((\d+)['΄']\)/);
  if (match) {
    cookTimeMin = Number(match[1]) || null;
    cleanTitle = title.replace(match[0], "").trim();
  } else {
    const matchMin = title.match(/\((\d+)\s*(?:λεπτά|min|minutes)\)/i);
    if (matchMin) {
      cookTimeMin = Number(matchMin[1]) || null;
      cleanTitle = title.replace(matchMin[0], "").trim();
    }
  }

  return { cleanTitle, cookTimeMin };
}

function parseRecipeContent(title, lines, annotations, { isChecklist = false } = {}) {
  const ingredients = [];
  const steps = [];
  let description = "";
  let servings = null;
  let sourceUrl = "";
  let videoUrl = "";

  // Extract cook time from title pattern like "(240')"
  const { cleanTitle, cookTimeMin } = extractTimeFromTitle(title);

  // Pull URL and description from web-link annotations first
  if (annotations.length > 0) {
    const ann = annotations[0];
    if (ann.url) {
      if (isVideoUrl(ann.url)) {
        videoUrl = ann.url;
      } else {
        sourceUrl = ann.url;
      }
    }
    if (ann.description) description = ann.description;
  }

  // Checklist notes are typically ingredient/shopping lists — default to ingredients mode
  let mode = isChecklist ? "ingredients" : "auto";

  for (const line of lines) {
    // Detect URLs
    const urlMatch = line.match(/https?:\/\/\S+/);
    if (urlMatch) {
      const url = urlMatch[0];
      if (isVideoUrl(url) && !videoUrl) {
        videoUrl = url;
      } else if (!isVideoUrl(url) && !sourceUrl) {
        sourceUrl = url;
      }
    }
    // Skip lines that are purely a URL (already captured above)
    if (urlMatch && line.trim() === urlMatch[0]) continue;

    // Detect servings
    const servingsMatch = line.match(
      /serves?\s*:?\s*(\d+)|(\d+)\s*servings?|portions?\s*:?\s*(\d+)|μερίδες\s*:?\s*(\d+)/i
    );
    if (servingsMatch) {
      servings =
        Number(
          servingsMatch[1] ||
            servingsMatch[2] ||
            servingsMatch[3] ||
            servingsMatch[4]
        ) || null;
      continue;
    }

    // Section header detection (explicit ingredient/step headers)
    if (isSectionHeader(line, SECTION_HEADERS_INGREDIENTS)) {
      mode = "ingredients";
      continue;
    }
    if (isSectionHeader(line, SECTION_HEADERS_STEPS)) {
      mode = "steps";
      continue;
    }

    // Greek sub-section headers ("Για το κότσι", "Για τη σάλτσα") — skip
    if (SUB_SECTION_RE.test(line.trim())) {
      continue;
    }

    // Mode-based classification
    if (mode === "ingredients") {
      if (line.trim()) {
        const parsed = parseIngredientLine(line);
        ingredients.push({ ...parsed, sortOrder: ingredients.length });
      }
    } else if (mode === "steps") {
      if (line.trim()) {
        const instruction = line.replace(/^\d+[.)]\s*/, "").trim();
        steps.push({ instruction, imageUrl: null, sortOrder: steps.length });
      }
    } else {
      if (looksLikeIngredient(line)) {
        const parsed = parseIngredientLine(line);
        ingredients.push({ ...parsed, sortOrder: ingredients.length });
      } else if (/^\d+[.)]\s/.test(line)) {
        const instruction = line.replace(/^\d+[.)]\s*/, "").trim();
        steps.push({ instruction, imageUrl: null, sortOrder: steps.length });
      } else if (
        ingredients.length === 0 &&
        steps.length === 0 &&
        !description
      ) {
        description = line;
      } else {
        steps.push({
          instruction: line,
          imageUrl: null,
          sortOrder: steps.length,
        });
      }
    }
  }

  return {
    title: cleanTitle,
    description,
    servings,
    prepTimeMin: null,
    cookTimeMin,
    sourceUrl,
    videoUrl,
    imageUrls: [],
    tags: [],
    ingredients,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Label matching (case-insensitive substring match)
// ---------------------------------------------------------------------------

function matchesLabelFilter(noteLabels) {
  if (labelFilters.length === 0) return true;
  const normalized = noteLabels.map((l) => l.toLowerCase());
  return labelFilters.some((filter) =>
    normalized.some((label) => label.includes(filter))
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const jsonFiles = fs
  .readdirSync(keepDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

const htmlFiles = fs
  .readdirSync(keepDir)
  .filter((f) => f.endsWith(".html"))
  .sort();

console.log(
  `Found ${jsonFiles.length} JSON file(s) and ${htmlFiles.length} HTML file(s) in ${keepDir}`
);

const recipes = [];
let skippedByLabel = 0;
let skippedEmpty = 0;
let skippedTrashed = 0;

// Process JSON files (primary format)
for (const file of jsonFiles) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(keepDir, file), "utf-8"));
  } catch {
    console.warn(`  Warning: could not parse ${file}, skipping.`);
    continue;
  }

  const note = extractNoteFromJson(raw);
  if (!note) {
    skippedTrashed++;
    continue;
  }

  if (!matchesLabelFilter(note.labels)) {
    skippedByLabel++;
    continue;
  }

  if (note.lines.length === 0 && !note.title && note.annotations.length === 0) {
    skippedEmpty++;
    continue;
  }

  const recipeTitle =
    note.title || file.replace(".json", "");

  const recipe = parseRecipeContent(
    recipeTitle,
    note.lines,
    note.annotations,
    { isChecklist: note.isChecklist }
  );

  recipe.tags = note.labels;
  recipes.push(recipe);
}

// Process HTML files (fallback for older exports)
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(keepDir, file), "utf-8");
  const note = extractNoteFromHtml(html);

  if (!matchesLabelFilter(note.labels)) {
    skippedByLabel++;
    continue;
  }

  if (note.lines.length === 0 && !note.title) {
    skippedEmpty++;
    continue;
  }

  const recipe = parseRecipeContent(
    note.title || file.replace(".html", ""),
    note.lines,
    note.annotations
  );
  recipe.tags = note.labels;
  recipes.push(recipe);
}

fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2), "utf-8");

console.log(`
Parsing complete:
  Recipes parsed  : ${recipes.length}
  Skipped (label) : ${skippedByLabel}
  Skipped (trashed): ${skippedTrashed}
  Skipped (empty) : ${skippedEmpty}
  Output written  : ${outputPath}

Next steps:
  1. Open ${outputPath} and review / edit the parsed recipes.
     - Fix any ingredient parsing issues
     - Add descriptions, servings, prep/cook times
     - Adjust tags (these are Keep label names; the import script
       will create or match tags in Firestore automatically)
  2. (Optional) Enrich with ingredient catalog matching:
     node enrich-recipes.mjs ${outputPath}
  3. Run the import:
     node import-recipes.mjs ${outputPath}
`);
