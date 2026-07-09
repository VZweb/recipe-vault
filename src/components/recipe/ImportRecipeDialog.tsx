import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MasterIngredient } from "@/types/ingredient";
import type { RecipeFormData } from "@/types/recipe";
import {
  parseImportedRecipeText,
  type ParseImportedRecipeResult,
} from "@/lib/chatgptRecipeImport";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";

export type ImportSaveTarget = "vault" | "library";

interface ImportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterIngredients: MasterIngredient[];
  recipeLibraryAdmin: boolean;
  onSave: (data: RecipeFormData, target: ImportSaveTarget) => Promise<string>;
}

export function ImportRecipeDialog({
  open,
  onOpenChange,
  masterIngredients,
  recipeLibraryAdmin,
  onSave,
}: ImportRecipeDialogProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [saveToSharedLibrary, setSaveToSharedLibrary] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      setPasteText("");
      setSaveToSharedLibrary(false);
      setClipboardError(null);
      setSaveError(null);
      setSaving(false);
    }
  }, [open]);

  const parseOutcome = useMemo(() => {
    if (!pasteText.trim()) {
      return { parsed: null as ParseImportedRecipeResult | null, error: null as string | null };
    }
    try {
      return {
        parsed: parseImportedRecipeText(pasteText, masterIngredients),
        error: null,
      };
    } catch (err) {
      return {
        parsed: null,
        error:
          err instanceof Error
            ? err.message
            : "Could not parse the pasted recipe.",
      };
    }
  }, [pasteText, masterIngredients]);

  const parsed = parseOutcome.parsed;
  const parseError = parseOutcome.error;

  const ingredientCount =
    parsed?.data.ingredients.filter((i) => !i.isSection).length ?? 0;
  const stepCount =
    parsed?.data.steps.filter((s) => s.instruction.trim()).length ?? 0;

  const handleDialogCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (saving) return;
    onOpenChange(false);
  };

  const handleReadClipboard = async () => {
    setClipboardError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardError("Clipboard is empty.");
        return;
      }
      setPasteText(text);
    } catch {
      setClipboardError("Could not read clipboard. Paste manually instead.");
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    setSaveError(null);
    const target: ImportSaveTarget =
      recipeLibraryAdmin && saveToSharedLibrary ? "library" : "vault";
    try {
      const id = await onSave(parsed.data, target);
      onOpenChange(false);
      navigate(target === "library" ? `/shared/${id}` : `/recipes/${id}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save recipe.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditFirst = () => {
    if (!parsed) return;
    onOpenChange(false);
    navigate("/recipes/new", {
      state: {
        importDraft: parsed.data,
        importSaveToSharedLibrary:
          recipeLibraryAdmin && saveToSharedLibrary,
      },
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleDialogCancel}
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-stone-900">
          Import from ChatGPT
        </h2>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={saving}
          className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-stone-600">
          Paste the full ChatGPT reply (including the{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">recipe-vault</code>{" "}
          block at the end).
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleReadClipboard()}
            disabled={saving}
          >
            <ClipboardPaste size={14} className="mr-1.5" />
            Read clipboard
          </Button>
        </div>

        {clipboardError && (
          <p className="text-sm text-red-600">{clipboardError}</p>
        )}

        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste ChatGPT response here…"
          rows={8}
          disabled={saving}
          className="text-sm"
        />

        {parseError && (
          <p className="text-sm text-red-600">{parseError}</p>
        )}

        {recipeLibraryAdmin && parsed && (
          <section className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
            <p className="text-sm font-medium text-stone-800 mb-2">Save location</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="importSaveTarget"
                  checked={!saveToSharedLibrary}
                  onChange={() => setSaveToSharedLibrary(false)}
                  disabled={saving}
                  className="text-brand-600 focus:ring-brand-500"
                />
                My recipes (private)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="importSaveTarget"
                  checked={saveToSharedLibrary}
                  onChange={() => setSaveToSharedLibrary(true)}
                  disabled={saving}
                  className="text-brand-600 focus:ring-brand-500"
                />
                Shared library (visible to all accounts)
              </label>
            </div>
          </section>
        )}

        {parsed && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
            {parsed.data.imageUrls.length > 0 && (
              <img
                src={parsed.data.imageUrls[0]}
                alt={parsed.data.title}
                className="mb-3 h-32 w-full rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <p className="font-medium text-stone-900">{parsed.data.title}</p>
            <p className="mt-1 text-stone-500">
              {ingredientCount} ingredient{ingredientCount !== 1 ? "s" : ""},{" "}
              {stepCount} step{stepCount !== 1 ? "s" : ""}
              {parsed.data.imageUrls.length > 0 &&
                `, ${parsed.data.imageUrls.length} photo${parsed.data.imageUrls.length !== 1 ? "s" : ""}`}
            </p>
            {parsed.warnings.map((warning) => (
              <p
                key={warning}
                className="mt-2 flex items-start gap-1.5 text-amber-700"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {warning}
              </p>
            ))}
          </div>
        )}

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 px-5 py-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        {parsed && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleEditFirst}
            disabled={saving}
          >
            Edit first
          </Button>
        )}
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!parsed || saving}
        >
          {saving ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Saving…
            </>
          ) : saveToSharedLibrary && recipeLibraryAdmin ? (
            "Add to shared library"
          ) : (
            "Add to vault"
          )}
        </Button>
      </div>
    </dialog>
  );
}
