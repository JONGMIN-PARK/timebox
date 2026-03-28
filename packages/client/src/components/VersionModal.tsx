import { useState, useEffect } from "react";
import { Info, ChevronDown, ChevronRight, X, Sparkles } from "lucide-react";
import { APP_VERSION, APP_BUILD_DATE, VERSION_HISTORY } from "@/lib/version";

interface VersionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function VersionModal({ open, onClose }: VersionModalProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    () => new Set([APP_VERSION])
  );

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-overlay p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-scale-in"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Info className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                TimeBox v{APP_VERSION}
              </h2>
              <p className="text-[11px] text-slate-400">
                Build {APP_BUILD_DATE}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl btn-ghost flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current version highlights */}
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {VERSION_HISTORY[0]?.highlights.map((h) => (
              <span
                key={h}
                className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-700 dark:from-blue-400/20 dark:to-indigo-400/20 dark:text-blue-300 border border-blue-200/50 dark:border-blue-500/30"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Version history */}
          <div className="space-y-2">
            {VERSION_HISTORY.map((entry) => {
              const isExpanded = expandedVersions.has(entry.version);
              const isCurrent = entry.version === APP_VERSION;

              return (
                <div
                  key={entry.version}
                  className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden"
                >
                  {/* Version header */}
                  <button
                    onClick={() => toggleVersion(entry.version)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={`text-sm font-bold ${
                          isCurrent
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        v{entry.version}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold">
                          LATEST
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">
                        {entry.date}
                      </span>
                    </div>
                  </button>

                  {/* Expandable content */}
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {/* Highlights */}
                      <div className="flex flex-wrap gap-1.5">
                        {entry.highlights.map((h) => (
                          <span
                            key={h}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* Categorized changes */}
                      {entry.changes.map((change) => (
                        <div key={change.category}>
                          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            {change.category}
                          </h4>
                          <ul className="space-y-1">
                            {change.items.map((item) => (
                              <li
                                key={item}
                                className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
                              >
                                <span className="text-blue-400 mt-0.5 flex-shrink-0">
                                  *
                                </span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
