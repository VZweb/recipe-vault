import { useEffect, useRef, useState } from "react";
import { normalizeText } from "@/lib/normalize";
import type { MasterIngredient } from "@/types/ingredient";

interface Props {
  ingredients: MasterIngredient[];
  value: string;
  placeholder?: string;
  className?: string;
  onSelect: (ingredient: MasterIngredient) => void;
  onChange: (value: string) => void;
}

export function IngredientAutocomplete({
  ingredients,
  value,
  placeholder,
  className = "",
  onSelect,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const query = normalizeText(value);

  const filtered =
    query.length < 1
      ? []
      : ingredients.filter((ing) => {
          const targets = [
            normalizeText(ing.name),
            normalizeText(ing.nameGr),
            ...ing.aliases.map(normalizeText),
          ];
          return targets.some(
            (t) => t.includes(query) || query.includes(t)
          );
        });

  useEffect(() => {
    setHighlightIdx(-1);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i < filtered.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i > 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      onSelect(filtered[highlightIdx]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.length >= 1) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {filtered.slice(0, 15).map((ing, idx) => (
            <li
              key={ing.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(ing);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === highlightIdx
                  ? "bg-brand-50 text-brand-700"
                  : "text-stone-700 hover:bg-stone-50"
              }`}
            >
              <span className="font-medium">{ing.name}</span>
              {ing.nameGr && (
                <span className="ml-1.5 italic text-stone-400">
                  ({ing.nameGr})
                </span>
              )}
              {ing.aliases.length > 0 && (
                <span className="ml-2 text-xs text-stone-400">
                  aka {ing.aliases.slice(0, 2).join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
