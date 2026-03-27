import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { MessageCircle, Link2, Unlink, Send, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelegramConfig {
  id: number;
  userId: number;
  chatId: string | null;
  active: boolean;
}

export default function TelegramSection() {
  const { t } = useI18n();
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    api.get<TelegramConfig>("/telegram/config").then(res => {
      if (res.success) setConfig(res.data ?? null);
      setLoading(false);
    });
  }, []);

  const isLinked = config?.chatId && config?.active;

  const handleGenerateCode = async () => {
    const res = await api.post<{ code: string; instruction: string }>("/telegram/generate-link", {});
    if (res.success && res.data) {
      setLinkCode(res.data.code);
    }
  };

  const handleCopyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/link ${linkCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    const res = await api.post("/telegram/unlink", {});
    if (res.success) {
      setConfig(null);
      setLinkCode("");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.post("/telegram/test", {});
    setTestResult(res.success ? "ok" : "fail");
    setTesting(false);
    setTimeout(() => setTestResult(null), 3000);
  };

  if (loading) return null;

  return (
    <section>
      <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <MessageCircle className="w-3.5 h-3.5" />
        {t("settings.telegram")}
      </h2>
      <div className="card p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", isLinked ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600")} />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {isLinked ? t("settings.telegramLinked") : t("settings.telegramNotLinked")}
            </span>
          </div>
          {isLinked && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                {testing ? "..." : t("settings.telegramTest")}
              </button>
              <button
                onClick={handleUnlink}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition-colors"
              >
                <Unlink className="w-3 h-3" />
                {t("settings.telegramUnlink")}
              </button>
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <p className={cn("text-xs", testResult === "ok" ? "text-green-500" : "text-red-500")}>
            {testResult === "ok" ? "✅ 테스트 메시지를 보냈습니다. 텔레그램을 확인하세요!" : "❌ 전송 실패"}
          </p>
        )}

        {/* Link flow for unlinked users */}
        {!isLinked && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("settings.telegramGuide")}
            </p>

            {/* Step 1: Generate code */}
            {!linkCode ? (
              <button
                onClick={handleGenerateCode}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                {t("settings.telegramGenerate")}
              </button>
            ) : (
              <div className="space-y-2">
                {/* Step 2: Show code */}
                <div className="bg-slate-100 dark:bg-slate-700/60 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("settings.telegramStep1")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-blue-600 dark:text-blue-400 select-all">
                      /link {linkCode}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title="Copy"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {t("settings.telegramStep2")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
