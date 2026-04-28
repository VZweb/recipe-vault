import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Package, X } from "lucide-react";
import type { Recipe } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";
import type { MasterIngredient } from "@/types/ingredient";
import { deletePantryItem, updatePantryItem } from "@/lib/firestore";
import {
  ingredientLinkKey,
  pantryLinkKey,
  resolveMasterIngredient,
} from "@/lib/ingredientRef";
import {
  buildCookPantryQueue,
  type CookPantryQueueEntry,
} from "@/lib/pantryRecipeMatch";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PANTRY_UNITS } from "@/types/pantry";

export type CookCountedReason = "skipped" | "completed" | "empty";

interface CookPantryWizardDialogProps {
  recipe: Pick<Recipe, "id" | "title" | "ingredients">;
  pantryItems: PantryItem[];
  masterIngredients: MasterIngredient[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountedCook: (reason: CookCountedReason) => void | Promise<void>;
}

export function CookPantryWizardDialog({
  recipe,
  pantryItems,
  masterIngredients,
  open,
  onOpenChange,
  onCountedCook,
}: CookPantryWizardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const countedRef = useRef(false);

  const queue = useMemo(
    () => buildCookPantryQueue(recipe, pantryItems),
    [recipe, pantryItems]
  );

  const [mode, setMode] = useState<"items" | "complete">("items");
  const [stepIndex, setStepIndex] = useState(0);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState<null | "save" | "remove">(null);
  const busy = pending !== null;
  const [stapleRemoveConfirm, setStapleRemoveConfirm] = useState(false);

  const current: CookPantryQueueEntry | undefined =
    queue.length > 0 && mode === "items" ? queue[stepIndex] : undefined;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    countedRef.current = false;
    setPending(null);
    setStapleRemoveConfirm(false);
    if (queue.length > 0) {
      setMode("items");
      setStepIndex(0);
    }
  }, [open, queue.length]);

  /** Step 0 is the first panel after open (no swipe). Later steps mount with swipe-in. */
  const shouldSwipeInStep =
    open && mode === "items" && queue.length > 0 && stepIndex > 0;

  useEffect(() => {
    if (!open || queue.length === 0 || mode !== "items" || !current) return;
    setQty(current.pantryItem.quantity?.toString() ?? "");
    setUnit(current.pantryItem.unit ?? "");
    setExpiresOn(current.pantryItem.expiresOn ?? "");
    setOpened(current.pantryItem.isOpened);
    setStapleRemoveConfirm(false);
  }, [open, queue.length, mode, stepIndex, current]);

  const fireCounted = useCallback(
    async (reason: CookCountedReason) => {
      if (countedRef.current) return;
      countedRef.current = true;
      try {
        await Promise.resolve(onCountedCook(reason));
      } finally {
        onOpenChange(false);
      }
    },
    [onCountedCook, onOpenChange]
  );

  const advanceOrComplete = useCallback(() => {
    if (stepIndex >= queue.length - 1) {
      setMode("complete");
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, queue.length]);

  const handleDialogCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (busy || countedRef.current) return;
    onOpenChange(false);
  };

  const handleSkipPantry = () => {
    if (busy || countedRef.current) return;
    void fireCounted("skipped");
  };

  const handleEmptyCount = () => {
    if (busy || countedRef.current) return;
    void fireCounted("empty");
  };

  const handleCompleteDone = () => {
    if (busy || countedRef.current) return;
    void fireCounted("completed");
  };

  const handleSkipItem = () => {
    if (busy) return;
    advanceOrComplete();
  };

  const handleRemove = async () => {
    if (!current || busy) return;
    if (current.pantryItem.isStaple && !stapleRemoveConfirm) {
      setStapleRemoveConfirm(true);
      return;
    }
    setStapleRemoveConfirm(false);
    setPending("remove");
    try {
      await deletePantryItem(current.pantryItem.id);
      advanceOrComplete();
    } finally {
      setPending(null);
    }
  };

  const handleApplyUpdate = async () => {
    if (!current || busy) return;
    setPending("save");
    try {
      const q = qty.trim() ? Number(qty) : null;
      const u = unit.trim() || null;
      const exp = expiresOn.trim() || null;
      await updatePantryItem(current.pantryItem.id, {
        quantity: q,
        unit: u,
        expiresOn: exp,
        isOpened: opened,
      });
      advanceOrComplete();
    } finally {
      setPending(null);
    }
  };

  const substituteLabel = (entry: CookPantryQueueEntry): string | null => {
    if (entry.matchKind !== "substitute") return null;
    const pk = pantryLinkKey(entry.pantryItem);
    if (!pk) return entry.pantryItem.name;
    for (const sub of entry.ingredient.substituteLinks ?? []) {
      const k = ingredientLinkKey(sub.masterIngredientId, sub.masterIngredientScope);
      if (k !== pk) continue;
      const mi = resolveMasterIngredient(
        sub.masterIngredientId,
        sub.masterIngredientScope,
        masterIngredients
      );
      return mi?.name ?? entry.pantryItem.name;
    }
    return entry.pantryItem.name;
  };

  const recipeLineLabel = (entry: CookPantryQueueEntry) => {
    const { ingredient: ing } = entry;
    const parts = [
      ing.quantity != null ? String(ing.quantity) : "",
      ing.unit?.trim() || "",
      ing.name,
    ].filter(Boolean);
    return parts.join(" ") || ing.name;
  };

  const total = queue.length;
  const stepNum = stepIndex + 1;

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleDialogCancel}
      className="m-auto w-[min(100%,26rem)] max-h-[min(90vh,40rem)] overflow-hidden rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[min(90vh,40rem)] flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              After cooking
            </p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-stone-900">
              Update your pantry
            </h2>
          </div>
          <button
            type="button"
            onClick={() => !busy && !countedRef.current && onOpenChange(false)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {total > 0 && mode === "items" && (
          <div className="shrink-0 border-b border-stone-50 px-4 py-2 sm:px-5">
            <button
              type="button"
              onClick={handleSkipPantry}
              disabled={busy}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              Skip pantry — just count this cook
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5">
          {total === 0 && (
            <div className="space-y-4">
              <div className="flex justify-center text-stone-400">
                <Package className="h-12 w-12" strokeWidth={1.25} />
              </div>
              <p className="text-center text-sm text-stone-600">
                Nothing from this recipe is linked to your pantry. You can still record
                that you cooked it.
              </p>
              <div className="flex justify-center pt-2">
                <Button onClick={handleEmptyCount} disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  Count this cook
                </Button>
              </div>
            </div>
          )}

          {total > 0 && mode === "items" && current && (
            <div key={stepIndex}>
              <div
                className={`space-y-5${shouldSwipeInStep ? " cook-pantry-step-animate" : ""}`}
              >
                <p className="text-center text-xs font-medium text-stone-500">
                  Pantry item {stepNum} of {total}
                </p>

                <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Recipe
                  </p>
                  <p className="mt-1 text-sm font-medium text-stone-800">
                    {recipeLineLabel(current)}
                  </p>
                  {current.ingredient.note?.trim() ? (
                    <p className="mt-1 text-xs text-stone-500 italic">
                      {current.ingredient.note}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50/60 p-4">
                  <div className="flex items-start gap-2">
                    <Package
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-green-800/90">
                        In your pantry
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">
                        {current.pantryItem.name}
                        {current.pantryItem.nameSecondary ? (
                          <span className="font-normal text-stone-500">
                            {" "}
                            ({current.pantryItem.nameSecondary})
                          </span>
                        ) : null}
                      </p>
                      {current.matchKind === "substitute" && (
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-stone-600">
                          <Link2 size={12} className="shrink-0 text-brand-500" />
                          <span>
                            Matched alternative
                            {(() => {
                              const subName = substituteLabel(current);
                              return subName ? `: ${subName}` : "";
                            })()}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {stapleRemoveConfirm && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    This is a staple. Remove it from the pantry anyway?
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setStapleRemoveConfirm(false)}
                        disabled={busy}
                      >
                        Keep in pantry
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void handleRemove()}
                        disabled={busy}
                      >
                        Remove anyway
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="grid grid-cols-2 items-end gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Update amount
                      </p>
                      <div className="flex min-w-0 items-end gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          disabled={busy}
                          className="w-16 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-20"
                        />
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          disabled={busy}
                          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                          <option value="">Unit</option>
                          {PANTRY_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                        Expiry date
                      </p>
                      <input
                        type="date"
                        value={expiresOn}
                        onChange={(e) => setExpiresOn(e.target.value)}
                        disabled={busy}
                        className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        aria-label="Expiry date"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={opened}
                      onChange={(e) => setOpened(e.target.checked)}
                      disabled={busy}
                      className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    Mark as opened
                  </label>
                </div>
              </div>

              <div className="mt-5 flex min-w-0 flex-row gap-1.5 border-t border-stone-100 pt-4 sm:gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="min-w-0 flex-1 basis-0 px-2 sm:px-3 sm:text-sm"
                  onClick={() => void handleApplyUpdate()}
                  disabled={busy}
                >
                  {pending === "save" ? <Spinner className="h-4 w-4" /> : null}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="min-w-0 flex-1 basis-0 px-2 sm:px-3 sm:text-sm"
                  onClick={() => void handleRemove()}
                  disabled={busy}
                >
                  {pending === "remove" ? <Spinner className="h-4 w-4" /> : null}
                  Remove
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-w-0 flex-1 basis-0 px-2 sm:px-3 sm:text-sm"
                  onClick={handleSkipItem}
                  disabled={busy}
                >
                  Skip
                </Button>
              </div>
            </div>
          )}

          {total > 0 && mode === "complete" && (
            <div className="space-y-4 py-2">
              <p className="text-center text-sm text-stone-600">
                Pantry updates are saved. Count this cook?
              </p>
              <div className="flex justify-center">
                <Button onClick={handleCompleteDone} disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  Done — count this cook
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
