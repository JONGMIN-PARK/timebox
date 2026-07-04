import type React from "react";

/** Wrap occurrences of `query` in the text with a highlight marker (case-insensitive). */
export function highlight(text: string | null | undefined, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || !text) return text ?? null;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lower = q.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lower ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
