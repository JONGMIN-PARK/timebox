import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { Calendar, Unlink, Download, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";

interface GCalConfig {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

interface GCalCalendar {
  id: string;
  summary: string;
  description: string | null;
  primary: boolean;
  backgroundColor: string;
}

type Period = "1w" | "1m" | "3m";

export default function GoogleCalendarSection() {
  const { t } = useI18n();
  const [config, setConfig] = useState<GCalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [selectedCals, setSelectedCals] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>("1m");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchConfig = useCallback(async () => {
    const res = await api.get<GCalConfig>("/google-calendar/config");
    if (res.success && res.data) setConfig(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const fetchCalendars = useCallback(async () => {
    const res = await api.get<GCalCalendar[]>("/google-calendar/calendars");
    if (res.success && res.data) {
      setCalendars(res.data);
      // Auto-select primary
      const primary = res.data.find((c) => c.primary);
      if (primary) setSelectedCals(new Set([primary.id]));
    }
  }, []);

  useEffect(() => {
    if (config?.connected) fetchCalendars();
  }, [config?.connected, fetchCalendars]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Get the redirect URI — we'll use a popup flow
      const origin = window.location.origin;
      const redirectUri = `${origin}/api/google-calendar/oauth-popup`;

      const res = await api.get<{ url: string }>(`/google-calendar/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`);
      if (!res.success || !res.data) {
        showToast("error", res.error || "Failed to get auth URL");
        setConnecting(false);
        return;
      }

      // Open popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        res.data.url,
        "google-oauth",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
      );

      // Listen for the callback message from the popup
      const handler = async (event: MessageEvent) => {
        if (event.origin !== origin) return;
        if (event.data?.type === "google-oauth-callback" && event.data.code) {
          window.removeEventListener("message", handler);
          popup?.close();

          const cbRes = await api.post<{ email: string }>("/google-calendar/callback", {
            code: event.data.code,
            redirectUri,
          });
          if (cbRes.success && cbRes.data) {
            showToast("success", t("settings.gcalConnected"));
            await fetchConfig();
          } else {
            showToast("error", cbRes.error || "Connection failed");
          }
          setConnecting(false);
        }
      };
      window.addEventListener("message", handler);

      // Fallback: if popup is closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handler);
          setConnecting(false);
        }
      }, 500);
    } catch {
      showToast("error", "Failed to connect");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const res = await api.post("/google-calendar/disconnect", {});
    if (res.success) {
      setConfig({ configured: true, connected: false, email: null });
      setCalendars([]);
      setSelectedCals(new Set());
      showToast("success", t("settings.gcalDisconnected"));
    }
  };

  const toggleCal = (id: string) => {
    setSelectedCals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedCals.size === 0) return;
    setImporting(true);
    setImportResult(null);

    const now = new Date();
    let from: string;
    let to: string;
    if (period === "1w") {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === "3m") {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      const res = await api.post<{ imported: number; updated: number }>("/google-calendar/import", {
        calendarIds: Array.from(selectedCals),
        from,
        to,
      });
      if (res.success && res.data) {
        setImportResult(res.data);
        showToast("success", t("settings.gcalImported"));
      } else {
        showToast("error", res.error || "Import failed");
      }
    } catch {
      showToast("error", "Import failed");
    }
    setImporting(false);
  };

  if (loading) return null;
  if (!config?.configured) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        {t("settings.googleCalendar")}
      </h2>
      <div className="card p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", config.connected ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600")} />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {config.connected
                ? `${t("settings.gcalConnected")}${config.email ? ` — ${config.email}` : ""}`
                : t("settings.gcalNotConnected")}
            </span>
          </div>
          {config.connected && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition-colors"
            >
              <Unlink className="w-3 h-3" />
              {t("settings.gcalDisconnect")}
            </button>
          )}
        </div>

        {/* Not connected → Connect button */}
        {!config.connected && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("settings.gcalGuide")}
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              {connecting ? t("common.loading") : t("settings.gcalConnect")}
            </button>
          </div>
        )}

        {/* Connected → Calendar list + Import */}
        {config.connected && calendars.length > 0 && (
          <div className="space-y-3">
            {/* Calendar list */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">
                {t("settings.gcalSelectCalendars")}
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {calendars.map((cal) => (
                  <label
                    key={cal.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCals.has(cal.id)}
                      onChange={() => toggleCal(cal.id)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {cal.summary}
                      {cal.primary && <span className="text-[10px] text-slate-400 ml-1">(primary)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">
                {t("settings.gcalPeriod")}
              </label>
              <div className="flex gap-1.5">
                {([
                  { value: "1w" as Period, label: t("settings.gcalPeriod1w") },
                  { value: "1m" as Period, label: t("settings.gcalPeriod1m") },
                  { value: "3m" as Period, label: t("settings.gcalPeriod3m") },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriod(value)}
                    className={cn(
                      "text-xs py-1.5 px-3 rounded-lg border transition-colors",
                      period === value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={importing || selectedCals.size === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? t("settings.gcalImporting") : t("settings.gcalImport")}
            </button>

            {/* Result */}
            {importResult && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" />
                {t("settings.gcalImportResult")
                  .replace("{imported}", String(importResult.imported))
                  .replace("{updated}", String(importResult.updated))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
