import { X, Keyboard, Command } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

interface Props { open: boolean; onClose: () => void; }

const shortcuts = [
  { keys: ["1"], action: "Calendar" },
  { keys: ["2"], action: "TimeBox" },
  { keys: ["3"], action: "Todos" },
  { keys: ["4"], action: "Files" },
  { keys: ["5"], action: "Scheduler" },
  { keys: ["?"], action: "Help" },
  { keys: ["Esc"], action: "Close modal / cancel" },
];

const telegramCmds = [
  { cmd: "/s", full: "/today", desc: "Daily briefing" },
  { cmd: "/a", full: "/add", desc: "Add event" },
  { cmd: "/t", full: "/todo", desc: "Add todo" },
  { cmd: "/l", full: "/list", desc: "Active todos" },
  { cmd: "/b", full: "/blocks", desc: "Time blocks" },
  { cmd: "/d", full: "/dday", desc: "D-Day list" },
  { cmd: "/check N", full: "", desc: "Complete todo #N" },
  { cmd: "/del N", full: "", desc: "Delete todo #N" },
  { cmd: "/week", full: "", desc: "Week summary" },
  { cmd: "/stats", full: "", desc: "Statistics" },
  { cmd: "/done", full: "", desc: "Completed todos" },
  { cmd: "/h", full: "/help", desc: "Bot help" },
];

const todoFlags = [
  { flag: "!high / !h", desc: "High priority" },
  { flag: "!low / !l", desc: "Low priority" },
  { flag: "@work / @w", desc: "Work category" },
  { flag: "@study / @s", desc: "Study category" },
  { flag: "@project / @p", desc: "Project category" },
  { flag: "@urgent / @u", desc: "Urgent category" },
];

export default function HelpModal({ open, onClose }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-overlay p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">{t("help.title")}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl btn-ghost flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("help.shortcuts")}</h3>
            <div className="space-y-1">
              {shortcuts.map((s) => (
                <div key={s.action} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{s.action}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-sm">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Telegram Commands */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("help.telegramTitle")}</h3>
            <div className="space-y-1">
              {telegramCmds.map((c) => (
                <div key={c.cmd} className="flex items-center gap-3 py-1">
                  <code className="text-xs font-mono text-blue-600 dark:text-blue-400 min-w-[80px]">{c.cmd}</code>
                  {c.full && <span className="text-[10px] text-slate-400">{c.full}</span>}
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">{c.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Todo Flags */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Todo Flags (Telegram)</h3>
            <p className="text-xs text-slate-400 mb-2">Add flags after todo title: <code className="text-blue-500">/t fix bug !high @work</code></p>
            <div className="grid grid-cols-2 gap-1">
              {todoFlags.map((f) => (
                <div key={f.flag} className="flex items-center gap-2 py-1">
                  <code className="text-[11px] font-mono text-amber-600 dark:text-amber-400">{f.flag}</code>
                  <span className="text-xs text-slate-500">{f.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("help.tipsTitle")}</h3>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <li>• Double-click a todo title to edit it inline</li>
              <li>• Click a category tag on a todo to change it</li>
              <li>• In monthly calendar, double-click a date to switch to day view</li>
              <li>• Drag todos by the grip handle to reorder</li>
              <li>• Scheduler: dump tasks in Brain Box → prioritize → schedule to grid</li>
              <li>• Settings → Data to export/import all your data</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
