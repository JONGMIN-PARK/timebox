import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";

interface Recipient {
  id: number;
  username: string;
  displayName: string | null;
}

/**
 * Shared "send to another user" picker. Loads the eligible recipient list
 * (`/inbox/users`) when opened and calls `onForward(userId)` on selection.
 * `onForward` returns true on success so the modal can close itself.
 */
export default function RecipientPickerModal({
  open,
  title,
  onClose,
  onForward,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onForward: (userId: number) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.get<Recipient[]>("/inbox/users").then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setRecipients(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const pick = async (userId: number) => {
    setSendingTo(userId);
    const ok = await onForward(userId);
    setSendingTo(null);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[80dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Send className="w-4 h-4 text-blue-500" /> {title}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-6">{t("common.loading")}</p>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">{t("notes.noRecipients")}</p>
          ) : (
            recipients.map((u) => (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                disabled={sendingTo != null}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-left"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  {(u.displayName || u.username || "U")[0].toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-900 dark:text-white truncate">{u.displayName || u.username}</span>
                  <span className="block text-[11px] text-slate-400 truncate">@{u.username}</span>
                </span>
                {sendingTo === u.id && <span className="text-[11px] text-blue-500">…</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
