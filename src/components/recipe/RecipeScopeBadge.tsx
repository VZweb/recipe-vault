import { BookOpen } from "lucide-react";
import type { RecipeScope } from "@/types/recipe";

type Variant = "inline" | "onImage";

interface RecipeScopeBadgeProps {
  scope: RecipeScope;
  /** `onImage`: readable on photos; `inline`: violet pill on light backgrounds */
  variant?: Variant;
}

/** Marks shared library recipes (vault recipes show nothing). */
export function RecipeScopeBadge({
  scope,
  variant = "inline",
}: RecipeScopeBadgeProps) {
  if (scope !== "library") return null;

  const title =
    "Shared library — visible to all signed-in users on this app";

  if (variant === "onImage") {
    return (
      <span
        className="pointer-events-none inline-flex items-center gap-0.5 rounded-md bg-stone-900/78 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur-[2px]"
        title={title}
      >
        <BookOpen size={10} strokeWidth={2.5} className="shrink-0" aria-hidden />
        Library
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800"
      title={title}
    >
      <BookOpen size={10} strokeWidth={2.5} className="shrink-0 opacity-90" aria-hidden />
      Library
    </span>
  );
}
