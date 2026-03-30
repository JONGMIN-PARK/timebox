// ── Unified category configuration ──
// Single source of truth for categories used by both todo and timeblock features.

export interface CategoryChild {
  id: string;
  label: string;
  /** Optional emoji shown before todo title; falls back to parent category icon */
  icon?: string;
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  children?: CategoryChild[];
}

// ── Todo categories ──
export const TODO_CATEGORIES: CategoryDef[] = [
  {
    id: "work", label: "Work", icon: "\u{1F4BC}", color: "#3b82f6",
    children: [
      { id: "work.meeting", label: "Meeting", icon: "\u{1F4C5}" },
      { id: "work.proposal", label: "Proposal", icon: "\u{1F4DD}" },
      { id: "work.dev", label: "Development", icon: "\u{1F4BB}" },
      { id: "work.review", label: "Review", icon: "\u{1F50D}" },
      { id: "work.report", label: "Report", icon: "\u{1F4CA}" },
      { id: "work.other", label: "Other", icon: "\u{1F4C1}" },
    ],
  },
  {
    id: "personal", label: "Personal", icon: "\u{1F3E0}", color: "#8b5cf6",
    children: [
      { id: "personal.errand", label: "Errand", icon: "\u{1F6CD}\uFE0F" },
      { id: "personal.health", label: "Health", icon: "\u{1F496}" },
      { id: "personal.finance", label: "Finance", icon: "\u{1F4B0}" },
      { id: "personal.other", label: "Other", icon: "\u{1F3E0}" },
    ],
  },
  {
    id: "study", label: "Study", icon: "\u{1F4DA}", color: "#f59e0b",
    children: [
      { id: "study.course", label: "Course", icon: "\u{1F393}" },
      { id: "study.reading", label: "Reading", icon: "\u{1F4D6}" },
      { id: "study.research", label: "Research", icon: "\u{1F52C}" },
    ],
  },
  {
    id: "project", label: "Project", icon: "\u{1F680}", color: "#10b981",
    children: [
      { id: "project.planning", label: "Planning", icon: "\u{1F4D0}" },
      { id: "project.design", label: "Design", icon: "\u{1F3A8}" },
      { id: "project.implementation", label: "Implementation", icon: "\u{2699}\uFE0F" },
    ],
  },
  { id: "urgent", label: "Urgent", icon: "\u{1F525}", color: "#ef4444" },
  { id: "idea", label: "Idea", icon: "\u{1F4A1}", color: "#06b6d4" },
];

// ── Timeblock categories ──
export const TIMEBLOCK_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  deep_work: { label: "Deep Work", color: "#3b82f6", icon: "\u{1F9E0}" },
  meeting:   { label: "Meeting",   color: "#8b5cf6", icon: "\u{1F465}" },
  email:     { label: "Email",     color: "#f59e0b", icon: "\u{1F4E7}" },
  exercise:  { label: "Exercise",  color: "#10b981", icon: "\u{1F4AA}" },
  break:     { label: "Break",     color: "#6b7280", icon: "\u2615" },
  personal:  { label: "Personal",  color: "#ec4899", icon: "\u{1F3E0}" },
  admin:     { label: "Admin",     color: "#f97316", icon: "\u{1F4CB}" },
  other:     { label: "Other",     color: "#94a3b8", icon: "\u{1F4CC}" },
};

// ── Helpers ──

/** Look up a todo category (or sub-category) by id */
export function getCategoryInfo(catId: string): { label: string; icon: string; color: string; parentLabel?: string } {
  for (const cat of TODO_CATEGORIES) {
    if (cat.id === catId) return { label: cat.label, icon: cat.icon, color: cat.color };
    if (cat.children) {
      const child = cat.children.find((c) => c.id === catId);
      if (child) {
        return {
          label: child.label,
          icon: child.icon ?? cat.icon,
          color: cat.color,
          parentLabel: cat.label,
        };
      }
    }
  }
  return { label: catId, icon: "\u{1F4CC}", color: "#94a3b8" };
}

/** Look up a timeblock category by id */
export function getTimeblockCategoryInfo(catId: string): { label: string; color: string; icon: string } {
  return TIMEBLOCK_CATEGORIES[catId] ?? { label: catId, color: "#94a3b8", icon: "\u{1F4CC}" };
}

// ── Backward-compatible type alias ──
export type TodoCategoryDef = CategoryDef;
