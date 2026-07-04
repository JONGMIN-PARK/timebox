import { Check } from "lucide-react";
import { highlight } from "@/lib/highlight";

// Re-exported for existing importers (e.g. NotesView).
export { highlight };

/** Matches a markdown-style checklist line: `- [ ] task` or `- [x] task`. */
export const CHECK_RE = /^(\s*)- \[([ xX])\] (.*)$/;

/** True if the text contains at least one checklist line. */
export function hasChecklist(content: string): boolean {
  return content.split("\n").some((l) => CHECK_RE.test(l));
}

/**
 * Renders note text: `- [ ]` / `- [x]` lines become checkboxes (interactive when
 * `onToggle` is given), other lines render as plain text. Search terms are highlighted.
 */
export default function NoteContent({
  content,
  query = "",
  onToggle,
  className,
  hideCompleted = false,
}: {
  content: string;
  query?: string;
  onToggle?: (lineIndex: number) => void;
  className?: string;
  /** When true, checked checklist lines are not rendered (indices stay stable). */
  hideCompleted?: boolean;
}) {
  const lines = content.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const m = line.match(CHECK_RE);
        if (m) {
          const checked = m[2].toLowerCase() === "x";
          if (hideCompleted && checked) return null;
          return (
            <div
              key={i}
              className={onToggle ? "flex items-start gap-1.5 py-0.5 cursor-pointer" : "flex items-start gap-1.5 py-0.5"}
              onClick={
                onToggle
                  ? (e) => {
                      e.stopPropagation();
                      onToggle(i);
                    }
                  : undefined
              }
            >
              <span
                role="checkbox"
                aria-checked={checked}
                className={
                  "mt-[1px] w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center " +
                  (checked ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-slate-600")
                }
              >
                {checked && <Check className="w-2.5 h-2.5" />}
              </span>
              <span className={checked ? "line-through text-slate-400" : "min-w-0 break-words"}>{highlight(m[3], query)}</span>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap break-words">
            {line ? highlight(line, query) : " "}
          </div>
        );
      })}
    </div>
  );
}
