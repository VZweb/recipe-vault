import { X } from "lucide-react";

interface TagChipProps {
  name: string;
  color: string;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export function TagChip({
  name,
  color,
  selected,
  onRemove,
  onClick,
}: TagChipProps) {
  const isInteractive = !!onClick;

  return (
    <span
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
        isInteractive ? "cursor-pointer" : ""
      } ${
        selected
          ? "ring-2 ring-offset-1"
          : "opacity-80 hover:opacity-100"
      }`}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        borderColor: color,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
          aria-label={`Remove ${name} tag`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
