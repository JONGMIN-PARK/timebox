import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface InputModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function InputModal({
  open, title, placeholder = "", defaultValue = "",
  submitLabel = "OK", cancelLabel = "Cancel",
  onSubmit, onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = () => {
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={placeholder}
          className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
            {cancelLabel}
          </button>
          <button onClick={handleSubmit} disabled={!value.trim()} className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40">
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
