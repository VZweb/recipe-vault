#!/usr/bin/env node
/**
 * seed-ingredients.mjs
 *
 * Extracts unique ingredient names from parsed-recipes.json and creates
 * master ingredient entries in Firestore. Existing catalog entries are
 * preserved — only new ingredients are added.
 *
 * Usage:
 *   node seed-ingredients.mjs <parsed-recipes.json> [--dry-run]
 *
 * After running, refine the catalog manually via the Ingredients page
 * (add Greek names, aliases, fix categories, merge duplicates).
 *
 * Requires a service account key at scripts/service-account.json
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

if (!jsonPath || args.includes("--help")) {
  console.log(`
Usage:
  node seed-ingredients.mjs <parsed-recipes.json> [--dry-run]

Options:
  --dry-run   Show what would be created without writing to Firestore
  --help      Show this help

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
// Normalization
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

// Strip Greek unit prefixes that got baked into ingredient names
// e.g., "κ.σ. ελαιόλαδο" → "ελαιόλαδο", "σκ. σκόρδο" → "σκόρδο"
const UNIT_PREFIX_RE =
  /^(?:κ\.σ\.?|κ\.γ\.?|γρ\.?|φλ\.?|τεμ\.?|σκ\.?|κλ\.?|κομ\.?|φετ\.?|πακ\.?|μπουκ\.?)\s+/i;

function cleanIngredientName(raw) {
  let name = raw.trim();

  // Strip unit prefixes
  name = name.replace(UNIT_PREFIX_RE, "");

  // Strip leading "of" / "από" that sometimes remains
  name = name.replace(/^(?:of|από)\s+/i, "");

  // Strip trailing commas, parenthetical notes
  name = name.replace(/\s*\(.*?\)\s*$/, "");
  name = name.replace(/,\s*$/, "");

  // Collapse whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

// ---------------------------------------------------------------------------
// Category guessing based on keywords
// ---------------------------------------------------------------------------

// Ordered by specificity — more specific rules first to avoid false matches
// e.g., "πελτέ ντομάτας" should match Condiments before Vegetables catches "ντομάτ"
const CATEGORY_RULES = [
  { pattern: /soy sauce|σάλτσα σόγιας|mustard|μουστάρδα|μουσταρδα|ketchup|κέτσαπ|hot sauce|sriracha|worcestershire|pesto|πέστο|πεστο|mayo|μαγιονέζα|μαγιονεζα|tahini|ταχίνι|ταχινι|πελτέ|πελτε|tomato paste|passata|πασάτα|πασατα|bbq|σάλτσα/i, category: "Condiments & Sauces" },
  { pattern: /canned|κονσέρβα|κονσερβα|chickpea|ρεβίθι|ρεβιθι|lentil|φακ[εέ]|coconut milk|γάλα καρύδα|κύβο|κυβο|broth|ζωμό|ζωμο|stock|bouillon/i, category: "Canned & Jarred" },
  { pattern: /chicken|κοτόπουλο|κοτοπουλο|turkey|γαλοπούλα|pork|χοιρινό|χοιρινο|beef|μοσχάρι|μοσχαρι|lamb|αρνί|αρνι|κιμά|κιμα|μπέικον|μπεικον|bacon|sausage|λουκάνικ|prosciutto|pancetta|steak|μπριζόλ|μπριζολ|φιλέτο.*κοτ|φιλετο.*κοτ|στήθος.*κοτ|στηθος.*κοτ|μπούτι|μπουτι/i, category: "Meat & Poultry" },
  { pattern: /fish|ψάρι|ψαρι|salmon|σολομό|σολομο|shrimp|γαρίδ|γαριδ|tuna|τόνο|τονο|cod|μπακαλιάρ|μπακαλιαρ|anchov|αντζούγ|αντζουγ|squid|καλαμάρ|καλαμαρ|octopus|χταπόδ|χταποδ|mussel|μύδι|μυδι|crab|lobster|seafood|θαλασσιν/i, category: "Fish & Seafood" },
  { pattern: /milk|γάλα|γαλα|cheese|τυρί|τυρι|φέτα|φετα|cream|κρέμα|κρεμα|yogurt|γιαούρτι|γιαουρτι|butter|βούτυρο|βουτυρο|egg|αυγό|αυγο|parmesan|παρμεζάν|παρμεζαν|mozzarella|μοτσαρέλα|μοτσαρελα|ricotta|ρικότα|ρικοτα|κεφαλοτύρι|κεφαλοτυρι|γραβιέρα|γραβιερα|ανθότυρο|ανθοτυρο|μανούρι|μανουρι|κασέρι|κασερι|κρέμα γάλακτος/i, category: "Dairy & Eggs" },
  { pattern: /rice|ρύζι|ρυζι|pasta|μακαρόνι|μακαρονι|spaghetti|σπαγγέτι|noodle|πένε|πενε|ζυμαρικ|flour|αλεύρι|αλευρι|bread|ψωμί|ψωμι|oat|βρώμη|βρωμη|quinoa|κινόα|κινοα|couscous|κουσκούς|κουσκους|tortilla|pita|πίτα|φύλλο κρούστας|φυλλο κρουστας|χυλοπίτ|χυλοπιτ|κριθαράκι|κριθαρακι|πλιγούρι|πλιγουρι|τραχανά|τραχανα/i, category: "Grains & Pasta" },
  { pattern: /olive oil|ελαιόλαδο|ελαιολαδο|oil|λάδι|λαδι|vinegar|ξύδι|ξυδι|sesame oil/i, category: "Oils & Vinegars" },
  { pattern: /sugar|ζάχαρη|ζαχαρη|baking powder|baking soda|μαγειρική σόδα|yeast|μαγιά|μαγια|cocoa|κακάο|κακαο|chocolate|σοκολάτα|σοκολατα|honey|μέλι|μελι|maple|corn ?starch|vanilla extract|πετιμέζι|πετιμεζι/i, category: "Baking" },
  { pattern: /almond|αμύγδαλ|αμυγδαλ|walnut|καρύδι|καρυδι|cashew|pistachio|φιστίκι|φιστικι|peanut|φυστίκι|φυστικι|sesame|σουσάμι|σουσαμι|pine nut|κουκουνάρι|κουκουναρι|sunflower|ηλιόσπορ|ηλιοσπορ|chia|flax|seed|σπόρ/i, category: "Nuts & Seeds" },
  { pattern: /salt|αλάτι|αλατι|pepper|πιπέρι|πιπερι|oregano|ρίγανη|ριγανη|basil|βασιλικό|βασιλικο|thyme|θυμάρι|θυμαρι|rosemary|δεντρολίβανο|δεντρολιβανο|parsley|μαϊντανό|μαιντανο|dill|άνηθο|ανηθο|mint|δυόσμο|δυοσμο|cinnamon|κανέλα|κανελα|paprika|πάπρικα|παπρικα|cumin|κύμινο|κυμινο|turmeric|κουρκουμ|bay leaf|δάφνη|δαφνη|chili|τσίλι|μπούκοβο|μπουκοβο|nutmeg|μοσχοκάρυδο|μοσχοκαρυδο|clove|γαρίφαλο|γαριφαλο|ginger|τζίντζερ|coriander|κόλιανδρο|κολιανδρο|saffron|κρόκο|κροκο|allspice|μπαχάρι|μπαχαρι|vanilla|βανίλια|βανιλια|καρδάμωμο|καρδαμωμο/i, category: "Spices & Herbs" },
  { pattern: /tomato|ντομάτ|ντοματ|onion|κρεμμύδι|κρεμμυδι|garlic|σκόρδο|σκορδο|potato|πατάτ|πατατ|carrot|καρότ|καροτ|pepper|πιπερι|zucchini|κολοκύθ|κολοκυθ|eggplant|μελιτζάν|μελιτζαν|spinach|σπανάκι|σπανακι|lettuce|μαρούλι|μαρουλι|cucumber|αγγούρι|αγγουρι|broccoli|μπρόκολο|μπροκολο|cabbage|λάχανο|λαχανο|mushroom|μανιτάρι|μανιταρι|celery|σέλινο|σελινο|leek|πράσο|πρασο|cauliflower|κουνουπίδι|κουνουπιδι|bean|φασόλ|φασολ|pea|αρακά|αρακα|artichoke|αγκινάρ|αγκιναρ|beetroot|παντζάρι|παντζαρι|asparagus|σπαράγγι|σπαραγγι|radish|ραπανάκι|ραπανακι|corn|καλαμπόκι|καλαμποκι|πιπερι[αά]/i, category: "Vegetables" },
  { pattern: /apple|μήλο|μηλο|lemon|λεμόνι|λεμονι|orange|πορτοκάλι|πορτοκαλι|banana|μπανάνα|μπανανα|strawberr|φράουλ|φραουλ|blueberr|raspberry|σμέουρ|avocado|αβοκάντο|αβοκαντο|lime|mango|μάνγκο|cherry|κεράσι|κερασι|grape|σταφύλι|σταφυλι|peach|ροδάκινο|ροδακινο|pear|αχλάδι|αχλαδι|fig|σύκο|συκο|pomegranate|ρόδι|ροδι|watermelon|καρπούζι|καρπουζι|melon|πεπόνι|πεπονι|cranberr|κράνμπερ|date|χουρμά|χουρμα/i, category: "Fruits" },
  { pattern: /frozen|κατεψυγμέν/i, category: "Frozen" },
];

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) return rule.category;
  }
  return "Other";
}

// ---------------------------------------------------------------------------
// Detect if a name is Greek or English
// ---------------------------------------------------------------------------

function isGreek(s) {
  return /[\u0370-\u03ff\u1f00-\u1fff]/.test(s);
}

// ---------------------------------------------------------------------------
// Load existing catalog from Firestore
// ---------------------------------------------------------------------------

async function loadExistingCatalog() {
  const snap = await db.collection("ingredients").get();
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const normalizedNames = new Set();
  for (const e of entries) {
    normalizedNames.add(normalize(e.name));
    if (e.nameGr) normalizedNames.add(normalize(e.nameGr));
    for (const alias of e.aliases || []) {
      normalizedNames.add(normalize(alias));
    }
  }
  return { entries, normalizedNames };
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
if (dryRun) console.log("** DRY RUN — nothing will be written to Firestore **");

// Extract and deduplicate ingredient names
const nameCount = new Map();    // cleaned name → occurrence count
const rawExamples = new Map();  // cleaned name → original raw name (for reference)

for (const recipe of recipes) {
  for (const ing of recipe.ingredients || []) {
    if (ing.isSection) continue;
    const raw = (ing.name || "").trim();
    if (!raw) continue;

    const cleaned = cleanIngredientName(raw);
    if (!cleaned || cleaned.length < 2) continue;

    const key = normalize(cleaned);
    nameCount.set(key, (nameCount.get(key) || 0) + 1);
    if (!rawExamples.has(key)) rawExamples.set(key, cleaned);
  }
}

console.log(`Found ${nameCount.size} unique ingredient name(s) across recipes.\n`);

// Load existing catalog (graceful fallback if Firestore is unreachable in dry-run)
let existingNames;
try {
  const catalog = await loadExistingCatalog();
  existingNames = catalog.normalizedNames;
  console.log(`Found ${existingNames.size} normalized name(s) already in catalog.\n`);
} catch (err) {
  if (dryRun) {
    console.warn(`  ⚠ Could not reach Firestore: ${err.code || err.message}`);
    console.warn(`  Continuing dry-run assuming empty catalog.\n`);
    existingNames = new Set();
  } else {
    throw err;
  }
}

// Filter out ingredients that already exist in the catalog
const toCreate = [];
let alreadyExists = 0;

for (const [key, count] of [...nameCount.entries()].sort((a, b) => b[1] - a[1])) {
  if (existingNames.has(key)) {
    alreadyExists++;
    continue;
  }

  const displayName = rawExamples.get(key) || key;
  const greek = isGreek(displayName);
  const category = guessCategory(displayName);

  toCreate.push({
    name: greek ? "" : displayName,
    nameGr: greek ? displayName : "",
    aliases: [],
    category,
    _key: key,
    _count: count,
  });
}

console.log(`Already in catalog : ${alreadyExists}`);
console.log(`New to create      : ${toCreate.length}\n`);

if (toCreate.length === 0) {
  console.log("Nothing new to add. Catalog is up to date.\n");
  process.exit(0);
}

// Show what will be created, grouped by category
const byCategory = {};
for (const item of toCreate) {
  const cat = item.category;
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(item);
}

for (const [cat, items] of Object.entries(byCategory).sort()) {
  console.log(`  ${cat} (${items.length}):`);
  for (const item of items.sort((a, b) => b._count - a._count).slice(0, dryRun ? 999 : 10)) {
    const label = item.name || item.nameGr;
    console.log(`    ${item._count}x  ${label}`);
  }
  if (!dryRun && items.length > 10) {
    console.log(`    ... and ${items.length - 10} more`);
  }
  console.log();
}

if (dryRun) {
  console.log("[dry-run] No entries written.\n");
  process.exit(0);
}

// Write to Firestore in batches of 500
const ingredientsCol = db.collection("ingredients");
const BATCH_SIZE = 450;
let created = 0;

for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
  const chunk = toCreate.slice(i, i + BATCH_SIZE);
  const batch = db.batch();

  for (const item of chunk) {
    const docRef = ingredientsCol.doc();
    batch.set(docRef, {
      name: item.name,
      nameGr: item.nameGr,
      aliases: item.aliases,
      category: item.category,
    });
  }

  await batch.commit();
  created += chunk.length;
  console.log(`  Committed batch: ${created}/${toCreate.length}`);
}

console.log(`
Seeding complete:
  Created   : ${created} new ingredient(s)
  Skipped   : ${alreadyExists} (already in catalog)

Next steps:
  1. Go to the Ingredients page in the app
  2. Review and refine:
     - Fill in missing English or Greek names
     - Add aliases for spelling variations
     - Fix any incorrect category assignments
     - Merge duplicates
  3. Re-run enrich-recipes.mjs to link recipes to the catalog
`);
