import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { IngredientAutocomplete } from "./IngredientAutocomplete";
import { INGREDIENT_CATEGORIES, type IngredientCategory } from "@/types/ingredient";
import type { MasterIngredient } from "@/types/ingredient";

interface Props {
  initialName: string;
  ingredients: MasterIngredient[];
  onCreated: (ingredient: MasterIngredient) => void;
  onCancel: () => void;
  onCreate: (item: Omit<MasterIngredient, "id">) => Promise<string>;
}

export function IngredientQuickAdd({ initialName, ingredients, onCreated, onCancel, onCreate }: Props) {
  const [name, setName] = useState(initialName);
  const [nameGr, setNameGr] = useState("");
  const [category, setCategory] = useState<IngredientCategory>("Other");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed]);
    }
    setAliasInput("");
  };

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const item = { name: name.trim(), nameGr: nameGr.trim(), category, aliases };
      const id = await onCreate(item);
      onCreated({ id, ...item });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 space-y-2"
    >
      <p className="text-xs font-medium text-amber-800">
        Not in catalog — create a new entry, or search again:
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <IngredientAutocomplete
          ingredients={ingredients}
          value={name}
          placeholder="Name"
          wrapperClassName="flex-1"
          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          onChange={(v) => setName(v)}
          onSelect={(mi) => onCreated(mi)}
        />
        <input
          type="text"
          value={nameGr}
          onChange={(e) => setNameGr(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          placeholder="Greek name (optional)"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as IngredientCategory)}
          className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {INGREDIENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Aliases */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={aliasInput}
          onChange={(e) => setAliasInput(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); addAlias(); }
          }}
          placeholder="Aliases (optional)"
          className="w-40 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {aliases.map((a, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700">
            {a}
            <button type="button" onClick={() => setAliases((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" disabled={!name.trim() || saving} onClick={handleCreate}>
          {saving ? <Spinner className="h-3 w-3" /> : <Plus size={14} />}
          {saving ? "Creating..." : "Create & Link"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
