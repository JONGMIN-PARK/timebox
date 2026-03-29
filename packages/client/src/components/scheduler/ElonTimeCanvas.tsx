import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { CATEGORY_CONFIG, type TimeBlock } from "@/stores/timeblockStore";
import {
  DAY_START_MIN,
  DAY_END_MIN,
  snapToStep,
  parseTimeToMinutes,
  parseBlockMeta,
  minutesToTime,
  uid,
  type FreehandSketchPoint,
  type FreehandSketchStroke,
} from "./elonStorage";

const MIN_BLOCK_MIN = 10;
const TAP_MOVE_PX = 10;

type Props = {
  blocks: TimeBlock[];
  pxPerMinute: number;
  snapStep: number;
  /** Dim blocks that are not Top-3 slots. */
  focusPriorityOnly?: boolean;
  /** How many other blocks link to this id. */
  incomingLinkCount?: Map<number, number>;
  onTapBackground: (startMinute: number) => void;
  onTapBlock: (block: TimeBlock) => void;
  onBlockTimeChange: (blockId: number, startTime: string, endTime: string) => void;
  /** Freehand strokes on the block column (normalized coords; client-only). */
  sketchStrokes?: FreehandSketchStroke[];
  onSketchStrokesChange?: (strokes: FreehandSketchStroke[]) => void;
  sketchMode?: boolean;
  sketchColor?: string;
};

type DragKind = "move" | "resize-start" | "resize-end";

type DragRef = {
  pointerId: number;
  kind: DragKind;
  blockId: number;
  startMin0: number;
  endMin0: number;
  grabOffsetMin: number;
  moved: boolean;
  originX: number;
  originY: number;
  captureEl: HTMLElement | null;
};

function sketchPointsToPathD(points: FreehandSketchPoint[], bandW: number, ppm: number): string {
  if (points.length === 0) return "";
  const w = Math.max(bandW, 1);
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = p.nx * w;
    const y = (p.m - DAY_START_MIN) * ppm;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

function clientToSketchPoint(
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement,
  bandEl: HTMLElement,
  ppm: number,
): FreehandSketchPoint {
  const srect = scrollEl.getBoundingClientRect();
  const y = clientY - srect.top + scrollEl.scrollTop;
  const m = DAY_START_MIN + y / ppm;
  const br = bandEl.getBoundingClientRect();
  const nx = Math.min(1, Math.max(0, (clientX - br.left) / Math.max(br.width, 1)));
  return { m: Math.min(DAY_END_MIN, Math.max(DAY_START_MIN, m)), nx };
}

export default function ElonTimeCanvas({
  blocks,
  pxPerMinute,
  snapStep,
  focusPriorityOnly = false,
  incomingLinkCount,
  onTapBackground,
  onTapBlock,
  onBlockTimeChange,
  sketchStrokes = [],
  onSketchStrokesChange,
  sketchMode = false,
  sketchColor = "#6366f1",
}: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sketchBandRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragRef | null>(null);
  const suppressClickRef = useRef(false);
  const sketchPointerIdRef = useRef<number | null>(null);
  const sketchDraftRef = useRef<FreehandSketchPoint[] | null>(null);
  const sketchStrokesRef = useRef(sketchStrokes);
  sketchStrokesRef.current = sketchStrokes;

  const [sketchBandW, setSketchBandW] = useState(0);
  const [liveSketchDraft, setLiveSketchDraft] = useState<FreehandSketchPoint[] | null>(null);
  const showSketchLayer = sketchMode || sketchStrokes.length > 0 || liveSketchDraft != null;

  const [livePreview, setLivePreview] = useState<Record<number, { s: number; e: number }>>({});
  const [ghostLabel, setGhostLabel] = useState<string | null>(null);
  const livePreviewRef = useRef<Record<number, { s: number; e: number }>>({});
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const snap = useCallback((m: number) => snapToStep(m, snapStep), [snapStep]);

  const layoutBlock = useCallback(
    (block: TimeBlock, preview?: { s: number; e: number } | null) => {
      let s = preview?.s ?? parseTimeToMinutes(block.startTime);
      let e = preview?.e ?? parseTimeToMinutes(block.endTime);
      if (e <= s) e = s + MIN_BLOCK_MIN;
      s = Math.max(s, DAY_START_MIN);
      e = Math.min(e, DAY_END_MIN);
      if (e <= s) return null;
      return {
        top: (s - DAY_START_MIN) * pxPerMinute,
        height: Math.max((e - s) * pxPerMinute, 20),
        startMin: s,
        endMin: e,
      };
    },
    [pxPerMinute],
  );

  const totalMin = DAY_END_MIN - DAY_START_MIN;
  const heightPx = totalMin * pxPerMinute;

  useEffect(() => {
    if (!showSketchLayer) return;
    const el = sketchBandRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSketchBandW(el.clientWidth));
    ro.observe(el);
    setSketchBandW(el.clientWidth);
    return () => ro.disconnect();
  }, [showSketchLayer, heightPx]);

  const minuteFromClientY = useCallback(
    (clientY: number) => {
      const el = scrollRef.current;
      if (!el) return DAY_START_MIN;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top + el.scrollTop;
      const raw = DAY_START_MIN + y / pxPerMinute;
      return snap(Math.min(Math.max(raw, DAY_START_MIN), DAY_END_MIN));
    },
    [pxPerMinute, snap],
  );

  const applyPreview = useCallback((blockId: number, s: number, e: number) => {
    const next = { ...livePreviewRef.current, [blockId]: { s, e } };
    livePreviewRef.current = next;
    setLivePreview(next);
    setGhostLabel(`${minutesToTime(s)}–${minutesToTime(e)}`);
  }, []);

  const clearPreview = useCallback(() => {
    dragRef.current = null;
    livePreviewRef.current = {};
    setLivePreview({});
    setGhostLabel(null);
  }, []);

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const dist = Math.hypot(ev.clientX - d.originX, ev.clientY - d.originY);
      if (dist > TAP_MOVE_PX) d.moved = true;

      const m = minuteFromClientY(ev.clientY);

      if (d.kind === "resize-end") {
        const ne = snap(Math.max(d.startMin0 + MIN_BLOCK_MIN, Math.min(DAY_END_MIN, m)));
        applyPreview(d.blockId, d.startMin0, ne);
      } else if (d.kind === "resize-start") {
        const ns = snap(Math.min(d.endMin0 - MIN_BLOCK_MIN, Math.max(DAY_START_MIN, m)));
        applyPreview(d.blockId, ns, d.endMin0);
      } else {
        const dur = d.endMin0 - d.startMin0;
        let ns = snap(m - d.grabOffsetMin);
        let ne = ns + dur;
        if (ns < DAY_START_MIN) {
          ne += DAY_START_MIN - ns;
          ns = DAY_START_MIN;
        }
        if (ne > DAY_END_MIN) {
          ns -= ne - DAY_END_MIN;
          ne = DAY_END_MIN;
        }
        if (ns < DAY_START_MIN) ns = DAY_START_MIN;
        if (ne < ns + MIN_BLOCK_MIN) ne = ns + MIN_BLOCK_MIN;
        applyPreview(d.blockId, ns, ne);
      }
    };

    const onUp = (ev: PointerEvent) => {
      const captured = dragRef.current;
      if (!captured || ev.pointerId !== captured.pointerId) return;
      try {
        captured.captureEl?.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }

      const prev = livePreviewRef.current[captured.blockId];
      const block = blocksRef.current.find((b) => b.id === captured.blockId);
      if (captured.moved && captured.blockId > 0 && prev && block) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 320);
        onBlockTimeChange(captured.blockId, minutesToTime(prev.s), minutesToTime(prev.e));
      } else if (!captured.moved && captured.kind === "move" && block) {
        onTapBlock(block);
      }

      clearPreview();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [minuteFromClientY, applyPreview, clearPreview, onBlockTimeChange, onTapBlock, snap]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 5; h <= 24; h++) list.push(h);
    return list;
  }, []);

  const linkLines = useMemo(() => {
    type L = { key: string; y1: number; y2: number; color: string };
    const out: L[] = [];
    for (const b of blocks) {
      if (b.id < 0) continue;
      const meta = parseBlockMeta(b.meta ?? null);
      const tid = meta.linkToBlockId;
      if (tid == null || tid === b.id) continue;
      const target = blocks.find((x) => x.id === tid);
      if (!target) continue;
      const g1 = layoutBlock(b, livePreview[b.id] ?? null);
      const g2 = layoutBlock(target, livePreview[target.id] ?? null);
      if (!g1 || !g2) continue;
      const y1 = g1.top + g1.height / 2;
      const y2 = g2.top + g2.height / 2;
      const color = b.color || CATEGORY_CONFIG[b.category]?.color || "#94a3b8";
      out.push({ key: `${b.id}-${tid}`, y1, y2, color });
    }
    return out;
  }, [blocks, livePreview, layoutBlock]);

  const annotationPins = useMemo(() => {
    type P = { key: string; top: number; text: string; color: string };
    const out: P[] = [];
    for (const b of blocks) {
      if (b.id < 0) continue;
      const meta = parseBlockMeta(b.meta ?? null);
      const color = b.color || CATEGORY_CONFIG[b.category]?.color || "#64748b";
      for (const a of meta.annotations ?? []) {
        const text = a.text?.trim();
        if (!text) continue;
        const am = Math.min(DAY_END_MIN, Math.max(DAY_START_MIN, a.atMinute));
        out.push({
          key: `${b.id}-${a.id}`,
          top: (am - DAY_START_MIN) * pxPerMinute,
          text,
          color,
        });
      }
    }
    return out;
  }, [blocks, pxPerMinute]);

  const minorGridStep = snapStep <= 15 ? snapStep : 15;

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (sketchMode) return;
      if (suppressClickRef.current) return;
      if ((e.target as HTMLElement).closest("[data-block-chip]")) return;
      if ((e.target as HTMLElement).closest("[data-annotation-pin]")) return;
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top + el.scrollTop;
      const rawMin = DAY_START_MIN + y / pxPerMinute;
      const snapped = snap(Math.min(Math.max(rawMin, DAY_START_MIN), DAY_END_MIN - MIN_BLOCK_MIN));
      onTapBackground(snapped);
    },
    [onTapBackground, pxPerMinute, snap, sketchMode],
  );

  const appendSketchPoint = useCallback(
    (p: FreehandSketchPoint) => {
      const prev = sketchDraftRef.current;
      if (!prev?.length) {
        sketchDraftRef.current = [p];
        setLiveSketchDraft([p]);
        return;
      }
      const last = prev[prev.length - 1];
      const dy = (p.m - last.m) * pxPerMinute;
      const dx = (p.nx - last.nx) * Math.max(sketchBandW, 48);
      if (Math.hypot(dx, dy) < 2.5) return;
      const next = [...prev, p];
      sketchDraftRef.current = next;
      setLiveSketchDraft(next);
    },
    [pxPerMinute, sketchBandW],
  );

  const handleSketchPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!sketchMode || !onSketchStrokesChange) return;
      e.preventDefault();
      e.stopPropagation();
      const scroll = scrollRef.current;
      const band = sketchBandRef.current;
      if (!scroll || !band) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      sketchPointerIdRef.current = e.pointerId;
      const p = clientToSketchPoint(e.clientX, e.clientY, scroll, band, pxPerMinute);
      sketchDraftRef.current = [p];
      setLiveSketchDraft([p]);
    },
    [sketchMode, onSketchStrokesChange, pxPerMinute],
  );

  const handleSketchPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (sketchPointerIdRef.current !== e.pointerId) return;
      const scroll = scrollRef.current;
      const band = sketchBandRef.current;
      if (!scroll || !band) return;
      e.preventDefault();
      const p = clientToSketchPoint(e.clientX, e.clientY, scroll, band, pxPerMinute);
      appendSketchPoint(p);
    },
    [appendSketchPoint, pxPerMinute],
  );

  const endSketchStroke = useCallback(
    (e: React.PointerEvent) => {
      if (sketchPointerIdRef.current !== e.pointerId) return;
      sketchPointerIdRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const draft = sketchDraftRef.current;
      sketchDraftRef.current = null;
      setLiveSketchDraft(null);
      if (draft && draft.length >= 2 && onSketchStrokesChange) {
        onSketchStrokesChange([
          ...sketchStrokesRef.current,
          { id: uid(), color: sketchColor, width: 2.6, points: draft },
        ]);
      }
    },
    [onSketchStrokesChange, sketchColor],
  );

  const startDrag = (
    e: React.PointerEvent,
    kind: DragKind,
    block: TimeBlock,
    startMin: number,
    endMin: number,
  ) => {
    if (block.id < 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const anchorMin = minuteFromClientY(e.clientY);
    const grabOffsetMin = anchorMin - startMin;

    dragRef.current = {
      pointerId: e.pointerId,
      kind,
      blockId: block.id,
      startMin0: startMin,
      endMin0: endMin,
      grabOffsetMin,
      moved: false,
      originX: e.clientX,
      originY: e.clientY,
      captureEl: e.currentTarget as HTMLElement,
    };
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden min-h-[220px]">
      <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("elon.timeTable")}</span>
        </div>
        <span className="text-[9px] text-slate-400 leading-snug">
          {sketchMode ? t("elon.sketchHint") : t("elon.timeTableHintDrag")}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="relative overflow-y-auto max-h-[min(55vh,420px)] touch-pan-y overscroll-contain"
        style={{ scrollBehavior: "smooth" }}
      >
        <div
          ref={trackRef}
          className="relative select-none"
          style={{ height: heightPx, minHeight: heightPx, touchAction: "pan-y" }}
          onClick={handleTrackClick}
        >
          <svg
            className="absolute left-0 top-0 w-7 z-[1] pointer-events-none overflow-visible"
            style={{ height: heightPx }}
            aria-hidden
          >
            {linkLines.map((ln, i) => (
              <line
                key={ln.key}
                x1={4 + (i % 3) * 2}
                y1={ln.y1}
                x2={4 + (i % 3) * 2}
                y2={ln.y2}
                stroke={ln.color}
                strokeWidth={2}
                strokeOpacity={0.35}
                strokeDasharray="4 3"
              />
            ))}
          </svg>

          {hours.map((h) => {
            const min = h * 60;
            if (min < DAY_START_MIN || min > DAY_END_MIN) return null;
            const top = (min - DAY_START_MIN) * pxPerMinute;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/80 pointer-events-none"
                style={{ top }}
              >
                <span className="absolute left-1 -top-2.5 text-[9px] text-slate-400 tabular-nums bg-white/90 dark:bg-slate-900/90 px-0.5">
                  {h}
                </span>
              </div>
            );
          })}
          {Array.from({ length: Math.ceil(totalMin / minorGridStep) }, (_, i) => i * minorGridStep).map((m) => (
            <div
              key={m}
              className="absolute left-8 right-1 border-t border-slate-50 dark:border-slate-800 pointer-events-none"
              style={{ top: m * pxPerMinute }}
            />
          ))}

          {annotationPins.map((pin) => (
            <div
              key={pin.key}
              data-annotation-pin
              className="absolute left-8 right-1 z-[15] flex items-start pointer-events-none"
              style={{ top: pin.top, transform: "translateY(-50%)" }}
            >
              <div
                className="max-w-[min(140px,45%)] rounded-md px-1.5 py-0.5 text-[8px] font-medium leading-tight shadow-sm border"
                style={{
                  borderColor: `${pin.color}88`,
                  backgroundColor: `${pin.color}22`,
                  color: "var(--tw-prose-body, inherit)",
                }}
              >
                <span className="text-slate-700 dark:text-slate-200">{pin.text}</span>
              </div>
            </div>
          ))}

          {ghostLabel && (
            <div className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-24 px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-[11px] font-medium tabular-nums shadow-lg pointer-events-none">
              {ghostLabel}
            </div>
          )}

          {blocks.map((block) => {
            const pv = livePreview[block.id] ?? null;
            const geo = layoutBlock(block, pv);
            if (!geo) return null;
            const cat = CATEGORY_CONFIG[block.category] || CATEGORY_CONFIG.other;
            const color = block.color || cat.color;
            const meta = parseBlockMeta(block.meta ?? null);
            const variant = meta.variant || "solid";
            const bg =
              variant === "stripes"
                ? `repeating-linear-gradient(-45deg, ${color}33, ${color}33 4px, ${color}18 4px, ${color}18 8px)`
                : variant === "outline"
                  ? "transparent"
                  : `${color}28`;
            const border = variant === "outline" ? `2px solid ${color}` : `1px solid ${color}55`;
            const z = pv ? 30 : 10;
            const dim =
              focusPriorityOnly && meta.prioritySlot == null && block.id > 0 ? "opacity-[0.36]" : "opacity-100";
            const incoming = incomingLinkCount?.get(block.id) ?? 0;

            return (
              <div
                key={block.id}
                data-block-chip
                className={cn(
                  "absolute left-7 right-1 rounded-lg shadow-sm z-10 overflow-hidden transition-opacity duration-200",
                  pv && "ring-2 ring-blue-400/70",
                  dim,
                )}
                style={{
                  top: geo.top,
                  height: geo.height,
                  background: bg,
                  border,
                  zIndex: z,
                }}
              >
                {block.id > 0 && (
                  <div
                    role="slider"
                    aria-label={t("elon.resizeStart")}
                    className="absolute top-0 left-0 right-0 h-3.5 cursor-ns-resize z-20 touch-none bg-gradient-to-b from-black/10 to-transparent dark:from-white/10"
                    onPointerDown={(e) => startDrag(e, "resize-start", block, geo.startMin, geo.endMin)}
                  />
                )}
                <div
                  className={cn(
                    "px-1.5 py-0.5 min-h-[28px] cursor-grab active:cursor-grabbing touch-none",
                    block.id < 0 && "cursor-default",
                  )}
                  onPointerDown={(e) => {
                    if (block.id < 0) return;
                    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
                    startDrag(e, "move", block, geo.startMin, geo.endMin);
                  }}
                >
                  <div className="flex items-start gap-0.5 min-h-0 pointer-events-none">
                    {meta.prioritySlot != null && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 shrink-0">{meta.prioritySlot}</span>
                    )}
                    {incoming > 0 && (
                      <span
                        className="text-[8px] font-semibold text-violet-600 dark:text-violet-300 shrink-0"
                        title={t("elon.incomingLinks")}
                      >
                        ←{incoming}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-slate-900 dark:text-white leading-tight line-clamp-3">
                      {cat.icon} {block.title}
                    </span>
                    {meta.showArrow && <span className="text-[9px] text-slate-500 shrink-0 ml-auto">↔</span>}
                  </div>
                  {meta.caption && (
                    <p className="text-[8px] text-blue-600 dark:text-blue-300 font-medium mt-0.5 line-clamp-1 pointer-events-none">{meta.caption}</p>
                  )}
                  {block.notes && geo.height > 36 && (
                    <p className="text-[8px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 pl-0.5 pointer-events-none">{block.notes}</p>
                  )}
                  <p className="text-[8px] text-slate-400 tabular-nums mt-0.5 pointer-events-none">
                    {minutesToTime(geo.startMin)}–{minutesToTime(geo.endMin)}
                  </p>
                </div>
                {block.id > 0 && (
                  <div
                    data-resize-handle
                    role="slider"
                    aria-label={t("elon.resizeEnd")}
                    className="absolute bottom-0 left-0 right-0 h-3.5 cursor-ns-resize z-20 touch-none bg-gradient-to-t from-black/10 to-transparent dark:from-white/10"
                    onPointerDown={(e) => startDrag(e, "resize-end", block, geo.startMin, geo.endMin)}
                  />
                )}
              </div>
            );
          })}

          {showSketchLayer && (
            <div
              ref={sketchBandRef}
              data-elon-sketch-band
              className={cn("absolute left-7 right-1 z-[40] top-0", sketchMode && "touch-none")}
              style={{
                height: heightPx,
                pointerEvents: sketchMode ? "auto" : "none",
              }}
              onClick={(ev) => ev.stopPropagation()}
              onPointerDown={handleSketchPointerDown}
              onPointerMove={handleSketchPointerMove}
              onPointerUp={endSketchStroke}
              onPointerCancel={endSketchStroke}
            >
              <svg className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
                {sketchStrokes.map((s) => (
                  <path
                    key={s.id}
                    d={sketchPointsToPathD(s.points, sketchBandW, pxPerMinute)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.92}
                  />
                ))}
                {liveSketchDraft && liveSketchDraft.length > 0 && (
                  <path
                    d={sketchPointsToPathD(liveSketchDraft, sketchBandW, pxPerMinute)}
                    fill="none"
                    stroke={sketchColor}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
