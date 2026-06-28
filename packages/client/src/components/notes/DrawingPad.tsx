import { useEffect, useRef, useState, useCallback } from "react";
import { Eraser, Save, Undo2 } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type Props = {
  onSave: (blob: Blob, ext: string, title: string) => Promise<void> | void;
};

const PALETTE = ["#0f172a", "#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
const CANVAS_H = 300;

export default function DrawingPad({ onSave }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);
  const undoStackRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  const fillWhite = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }, []);

  // Size the canvas to its container (crisp via devicePixelRatio).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 320;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    fillWhite(ctx, cssW, CANVAS_H);
  }, [fillWhite]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    // snapshot for undo
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    const last = lastRef.current!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    dirtyRef.current = true;
    if (!hasDrawing) setHasDrawing(true);
  };

  const up = (e: React.PointerEvent) => {
    drawingRef.current = false;
    lastRef.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const undo = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const prev = undoStackRef.current.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
    setHasDrawing(undoStackRef.current.length > 0 || dirtyRef.current);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    undoStackRef.current = [];
    fillWhite(ctx, canvas.clientWidth, CANVAS_H);
    dirtyRef.current = false;
    setHasDrawing(false);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;
    setSaving(true);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (blob) await onSave(blob, "png", title.trim());
    setSaving(false);
    setTitle("");
    clear();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={["w-6 h-6 rounded-full border-2 transition-transform", color === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"].join(" ")}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={undo} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500" title={t("notes.undo")}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={clear} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500" title={t("notes.clear")}>
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: CANVAS_H, touchAction: "none" }}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("notes.titlePlaceholder")}
        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving || !hasDrawing} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium">
          <Save className="w-4 h-4" /> {t("notes.add")}
        </button>
      </div>
    </div>
  );
}
