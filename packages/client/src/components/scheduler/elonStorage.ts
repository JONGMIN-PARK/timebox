import type { TimeBlockCategory } from "@/stores/timeblockStore";

/** Pin / milestone text anchored at a time (same day). */
export type TimelineAnnotation = {
  id: string;
  text: string;
  /** Minutes from midnight (e.g. 9:30 → 570). */
  atMinute: number;
};

export type TimeBlockMeta = {
  brainId?: string;
  prioritySlot?: 1 | 2 | 3;
  showArrow?: boolean;
  variant?: "solid" | "stripes" | "outline";
  /** Short on-canvas label (e.g. "→ 딥워크"). */
  caption?: string;
  /** Draw a faint gutter line to another block on the same day. */
  linkToBlockId?: number;
  /** Extra callouts on the timeline (owned by this block). */
  annotations?: TimelineAnnotation[];
};

/** Remove empty optional fields before JSON.stringify. */
export function compactMeta(m: Partial<TimeBlockMeta>): TimeBlockMeta {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as TimeBlockMeta;
}

export function parseBlockMeta(raw: string | null | undefined): TimeBlockMeta {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as TimeBlockMeta;
  } catch {
    return {};
  }
}

export function stringifyBlockMeta(m: TimeBlockMeta): string | null {
  const c = compactMeta(m);
  if (Object.keys(c).length === 0) return null;
  return JSON.stringify(c);
}

export interface BrainItem {
  id: string;
  text: string;
  notes: string;
  category: TimeBlockCategory;
  duration: number;
}

/** Legacy localStorage shape (before brain + notes split). */
interface LegacyPriorityItem {
  id: string;
  text: string;
  category: TimeBlockCategory;
  duration: number;
  rank: number;
  scheduled: boolean;
}

function safeSave(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

const brainKey = (d: string) => `tb_brain_${d}`;
const top3Key = (d: string) => `tb_top3_${d}`;
const oldPriorityKey = (d: string) => `tb_priority_${d}`;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadBrainItems(date: string): BrainItem[] {
  try {
    const raw = localStorage.getItem(brainKey(date));
    if (raw) {
      const parsed = JSON.parse(raw) as BrainItem[];
      if (Array.isArray(parsed) && parsed.length && "text" in parsed[0]) {
        return parsed.map((b) => ({
          id: b.id || uid(),
          text: b.text || "",
          notes: typeof b.notes === "string" ? b.notes : "",
          category: b.category || "deep_work",
          duration: typeof b.duration === "number" ? b.duration : 30,
        }));
      }
    }
    const old = localStorage.getItem(oldPriorityKey(date));
    if (old) {
      const legacy = JSON.parse(old) as LegacyPriorityItem[];
      if (Array.isArray(legacy)) {
        const migrated: BrainItem[] = legacy.map((p) => ({
          id: p.id || uid(),
          text: p.text || "",
          notes: "",
          category: p.category || "deep_work",
          duration: typeof p.duration === "number" ? p.duration : 30,
        }));
        saveBrainItems(date, migrated);
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveBrainItems(date: string, items: BrainItem[]) {
  safeSave(brainKey(date), JSON.stringify(items));
}

export type Top3Tuple = [string, string, string];

export function loadTop3(date: string): Top3Tuple {
  try {
    const raw = localStorage.getItem(top3Key(date));
    if (raw) {
      const a = JSON.parse(raw) as string[];
      if (Array.isArray(a)) {
        return [a[0] ?? "", a[1] ?? "", a[2] ?? ""];
      }
    }
  } catch {
    /* ignore */
  }
  return ["", "", ""];
}

export function saveTop3(date: string, slots: Top3Tuple) {
  safeSave(top3Key(date), JSON.stringify(slots));
}

export const DAY_START_MIN = 5 * 60;
export const DAY_END_MIN = 24 * 60;
/** Default snap when caller does not pass a step. */
export const SNAP_MINUTES_DEFAULT = 10;
/** Base scale; multiply by zoom for actual px/min. */
export const PX_PER_MINUTE_BASE = 1.12;
/** @deprecated use PX_PER_MINUTE_BASE * zoom */
export const PX_PER_MINUTE = PX_PER_MINUTE_BASE;

/** Persisted timeline UI (client only). */
export const ELON_VIEW_PREFS_KEY = "tb_elon_timeline_view";

export type ElonViewPrefs = {
  zoomIdx: number;
  snap: 5 | 10 | 15 | 30;
  focusPriority: boolean;
};

export const ELON_ZOOM_MULTIPLIERS = [0.78, 0.92, 1.08, 1.28, 1.52] as const;

/** Normalized point on the block column (minute + horizontal 0–1). */
export type FreehandSketchPoint = { m: number; nx: number };

/** One polyline drawn on the day timeline (client-only persistence). */
export type FreehandSketchStroke = {
  id: string;
  color: string;
  width: number;
  points: FreehandSketchPoint[];
};

const sketchKey = (d: string) => `tb_elon_sketch_v1_${d}`;

export function loadDaySketch(date: string): FreehandSketchStroke[] {
  // Try localStorage first (instant)
  const raw = localStorage.getItem(sketchKey(date));
  if (raw) {
    try {
      const p = JSON.parse(raw) as FreehandSketchStroke[];
      if (Array.isArray(p)) {
        return p.filter(
          (s) =>
            s &&
            typeof s.id === "string" &&
            typeof s.color === "string" &&
            typeof s.width === "number" &&
            Array.isArray(s.points),
        );
      }
    } catch { /* fall through */ }
  }
  // If no local data, try loading from server in background
  const token = localStorage.getItem("token");
  if (token) {
    fetch(`/api/sketches/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.strokes) {
          localStorage.setItem(sketchKey(date), JSON.stringify(data.data.strokes));
        }
      })
      .catch(() => {});
  }
  return [];
}

export function saveDaySketch(date: string, strokes: FreehandSketchStroke[]): void {
  // Keep localStorage for instant cache
  safeSave(sketchKey(date), JSON.stringify(strokes));
  // Async sync to server (fire-and-forget)
  const token = localStorage.getItem("token");
  if (token) {
    fetch(`/api/sketches/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ strokes }),
    }).catch(() => {});
  }
}

export function snapToStep(m: number, stepMinutes: number): number {
  if (stepMinutes <= 0) return Math.round(m);
  return Math.round(m / stepMinutes) * stepMinutes;
}

export function snapMinutes(m: number): number {
  return snapToStep(m, SNAP_MINUTES_DEFAULT);
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return DAY_START_MIN;
  return Math.min(DAY_END_MIN, Math.max(0, h * 60 + m));
}

export function minutesToTime(total: number): string {
  const capped = Math.min(Math.max(0, total), DAY_END_MIN);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
