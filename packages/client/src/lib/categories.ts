// ── Unified category configuration ──
// Single source of truth for categories used by both todo and timeblock features.

export interface CategoryChild {
  id: string;
  label: string;
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
      { id: "work.meeting", label: "Meeting" },
      { id: "work.proposal", label: "Proposal" },
      { id: "work.dev", label: "Development" },
      { id: "work.review", label: "Review" },
      { id: "work.report", label: "Report" },
      { id: "work.other", label: "Other" },
    ],
  },
  {
    id: "personal", label: "Personal", icon: "\u{1F3E0}", color: "#8b5cf6",
    children: [
      { id: "personal.errand", label: "Errand" },
      { id: "personal.health", label: "Health" },
      { id: "personal.finance", label: "Finance" },
      { id: "personal.other", label: "Other" },
    ],
  },
  {
    id: "study", label: "Study", icon: "\u{1F4DA}", color: "#f59e0b",
    children: [
      { id: "study.course", label: "Course" },
      { id: "study.reading", label: "Reading" },
      { id: "study.research", label: "Research" },
    ],
  },
  {
    id: "project", label: "Project", icon: "\u{1F680}", color: "#10b981",
    children: [
      { id: "project.planning", label: "Planning" },
      { id: "project.design", label: "Design" },
      { id: "project.implementation", label: "Implementation" },
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
      if (child) return { label: child.label, icon: cat.icon, color: cat.color, parentLabel: cat.label };
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
