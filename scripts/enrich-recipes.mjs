#!/usr/bin/env node
/**
 * enrich-recipes.mjs
 *
 * Reads a parsed-recipes JSON file, fetches the master ingredient catalog
 * from Firestore, and attempts to match each recipe ingredient to a catalog
 * entry. Matched ingredients get `masterIngredientId` and `nameSecondary`
 * populated automatically.
 *
 * Usage:
 *   node enrich-recipes.mjs <parsed-recipes.json> [--output enriched-recipes.json] [--dry-run]
 *
 * Requires a service account key at scripts/service-account.json
 * (or set GOOGLE_APPLICATION_CREDENTIALS env var to the key path).
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jsonPath = args.find((a) => !a.startsWith("--"));
const outputIdx = args.findIndex((a) => a === "--output" || a === "-o");
const outputPath =
  outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : null;

if (!jsonPath || args.includes("--help")) {
  console.log(`
Usage:
  node enrich-recipes.mjs <parsed-recipes.json> [--output <file.json>] [--dry-run]

Options:
  --output, -o   Output JSON path (defaults to overwriting the input file)
  --dry-run      Show matches without writing any files
  --help         Show this help

Requires:
  scripts/service-account.json  (Firebase Admin service account key)
`);
  process.exit(0);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: file not found: ${jsonPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------

const scriptDir = import.meta.dirname;
const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(scriptDir, "service-account.json");

if (!fs.existsSync(saPath)) {
  console.error(
    `Service account key not found at: ${saPath}\n\n` +
      "To generate one:\n" +
      "  1. Go to Firebase Console → Project Settings → Service Accounts\n" +
      "  2. Click 'Generate new private key'\n" +
      "  3. Save the downloaded file as scripts/service-account.json\n"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
db.settings({ preferRest: true });

// ---------------------------------------------------------------------------
// Text normalization (mirrors src/lib/normalize.ts)
// ---------------------------------------------------------------------------

function normalize(s) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ");
}

// Strip unit prefixes / qualifiers that leak into ingredient names
const UNIT_PREFIX_RE =
  /^(?:κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|σκ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?)\s+/i;

const PAREN_QTY_RE =
  /^\((?:about\s+)?[\d.]+\s*(?:ml|g|kg|oz|lb|lbs|cups?|tbsp|tsp)?\)\s*/i;

function cleanForMatching(name) {
  let s = name.trim();
  s = s.replace(UNIT_PREFIX_RE, "");
  s = s.replace(PAREN_QTY_RE, "");
  s = s.replace(/^(?:of|από)\s+/i, "");
  s = s.replace(/,\s.*$/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ---------------------------------------------------------------------------
// Load master ingredient catalog
// ---------------------------------------------------------------------------

async function loadCatalog() {
  const snap = await db.collection("ingredientCatalog").orderBy("name").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

function buildMatchIndex(catalog) {
  // For each master ingredient, collect all normalized searchable strings
  return catalog.map((item) => {
    const targets = [
      normalize(item.name),
      ...(item.nameGr ? [normalize(item.nameGr)] : []),
      ...(item.aliases || []).map(normalize),
    ];
    return { item, targets };
  });
}

function findBestMatch(ingredientName, index) {
  const normalized = normalize(ingredientName);
  if (!normalized) return null;

  // Also try a cleaned version (unit prefixes / qualifiers stripped)
  const cleaned = normalize(cleanForMatching(ingredientName));
  const candidates = [normalized];
  if (cleaned && cleaned !== normalized) candidates.push(cleaned);

  // Priority 1: exact match against any target
  for (const candidate of candidates) {
    for (const entry of index) {
      if (entry.targets.some((t) => t === candidate)) {
        return { match: entry.item, type: "exact" };
      }
    }
  }

  // Priority 2: substring match (either direction)
  for (const candidate of candidates) {
    for (const entry of index) {
      if (
        entry.targets.some(
          (t) =>
            (candidate.includes(t) && t.length >= 3) ||
            (t.includes(candidate) && candidate.length >= 3)
        )
      ) {
        return { match: entry.item, type: "substring" };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const recipes = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

if (!Array.isArray(recipes)) {
  console.error("Error: JSON root must be an array of recipe objects.");
  process.exit(1);
}

console.log(`\nLoaded ${recipes.length} recipe(s) from ${jsonPath}`);

const catalog = await loadCatalog();
console.log(`Loaded ${catalog.length} master ingredient(s) from Firestore.\n`);

if (catalog.length === 0) {
  console.warn(
    "Warning: ingredient catalog is empty. Populate the catalog first\n" +
      "via the Ingredients page, then re-run this script.\n"
  );
  process.exit(0);
}

const matchIndex = buildMatchIndex(catalog);

let totalIngredients = 0;
let totalMatched = 0;
let totalUnmatched = 0;
const unmatchedNames = new Map(); // name → count

for (let i = 0; i < recipes.length; i++) {
  const recipe = recipes[i];
  if (!recipe.ingredients || recipe.ingredients.length === 0) continue;

  let recipeMatched = 0;

  for (const ing of recipe.ingredients) {
    if (ing.isSection) continue;
    totalIngredients++;

    // Try matching on name
    const result = findBestMatch(ing.name, matchIndex);

    if (result) {
      ing.masterIngredientId = result.match.id;
      ing.masterIngredientScope = "catalog";
      ing.nameSecondary = result.match.nameGr || "";

      // Extract qualifier text as note (e.g. "πράσα, χοντροκομμένα" → note: "χοντροκομμένα")
      if (!ing.note) {
        const commaIdx = ing.name.indexOf(",");
        if (commaIdx !== -1) {
          ing.note = ing.name.slice(commaIdx + 1).trim();
        }
      }

      recipeMatched++;
      totalMatched++;

      if (dryRun) {
        const noteInfo = ing.note ? ` [note: "${ing.note}"]` : "";
        console.log(
          `  ✓ [${result.type}] "${ing.name}" → ${result.match.name} (${result.match.nameGr || "—"})${noteInfo}`
        );
      }
    } else {
      ing.masterIngredientId = null;
      ing.masterIngredientScope = null;
      ing.nameSecondary = ing.nameSecondary || "";
      totalUnmatched++;

      const key = normalize(ing.name);
      unmatchedNames.set(key, (unmatchedNames.get(key) || 0) + 1);

      if (dryRun) {
        console.log(`  ✗ "${ing.name}" — no match`);
      }
    }
  }

  if (dryRun && recipe.ingredients.length > 0) {
    console.log(
      `  [${i + 1}/${recipes.length}] "${recipe.title}": ${recipeMatched}/${recipe.ingredients.length} matched\n`
    );
  }
}

// Report
console.log(`\nEnrichment summary:`);
console.log(`  Total ingredients : ${totalIngredients}`);
console.log(`  Matched           : ${totalMatched} (${totalIngredients > 0 ? Math.round((totalMatched / totalIngredients) * 100) : 0}%)`);
console.log(`  Unmatched         : ${totalUnmatched}`);

if (unmatchedNames.size > 0) {
  console.log(`\n  Top unmatched ingredient names:`);
  const sorted = [...unmatchedNames.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [name, count] of sorted) {
    console.log(`    ${count}x  "${name}"`);
  }
  console.log(
    `\n  Tip: Add these to the Ingredient Catalog, then re-run this script.`
  );
}

if (!dryRun) {
  const outFile = outputPath || jsonPath;
  fs.writeFileSync(outFile, JSON.stringify(recipes, null, 2), "utf-8");
  console.log(`\n  Enriched output written to: ${outFile}`);
} else {
  console.log(`\n  [dry-run] No files written.`);
}

console.log("");
