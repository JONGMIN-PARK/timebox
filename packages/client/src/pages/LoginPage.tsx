import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { playLoginMelody } from "@/lib/loginSound";

type Mode = "login" | "request" | "requested";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const { login, loading, error } = useAuthStore();
  const [reqError, setReqError] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password) {
      const ok = await login(username.trim(), password);
      if (ok) playLoginMelody();
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setReqLoading(true);
    setReqError("");
    const res = await api.post<{ id: number }>("/auth/request", {
      username: username.trim(),
      password,
      displayName: displayName.trim() || undefined,
      message: message.trim() || undefined,
    });
    setReqLoading(false);
    if (res.success) {
      setMode("requested");
    } else {
      setReqError(res.error || "Request failed");
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 relative overflow-hidden safe-top">
      <div className="absolute inset-0 particles">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] animate-[ambientFloat_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/8 blur-[120px] animate-[ambientFloat_25s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[40%] right-[30%] w-[30%] h-[30%] rounded-full bg-pink-600/5 blur-[100px] animate-[ambientFloat_15s_ease-in-out_infinite_2s]" />
      </div>

      <div className="relative w-full max-w-[380px] p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30 mb-5">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight gradient-text">TimeBox</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            {mode === "login" && t("auth.signInToContinue")}
            {mode === "request" && t("auth.requestAnAccount")}
            {mode === "requested" && t("auth.requestSubmitted")}
          </p>
        </div>

        {/* ── Login Form ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.username")}</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.enterUsername")}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.password")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.enterPassword")}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            {error && (
              <div className="text-red-400 text-xs text-center py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in">{error}</div>
            )}
            <button type="submit" disabled={!username.trim() || !password || loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-[0.98] mt-2">
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setMode("request"); setUsername(""); setPassword(""); setReqError(""); }}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                {t("auth.noAccount")} <span className="text-blue-500 font-medium">{t("auth.requestAccess")}</span>
              </button>
            </div>
          </form>
        )}

        {/* ── Request Access Form ── */}
        {mode === "request" && (
          <form onSubmit={handleRequest} className="space-y-4 animate-in">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.username")}</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.chooseUsername")}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.password")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.choosePassword")}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.displayName")} <span className="normal-case text-slate-600">({t("auth.optional")})</span></label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("auth.yourName")}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">{t("auth.messageToAdmin")} <span className="normal-case text-slate-600">({t("auth.optional")})</span></label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("auth.whyAccess")}
                rows={2}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all resize-none" />
            </div>
            {reqError && (
              <div className="text-red-400 text-xs text-center py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in">{reqError}</div>
            )}
            <button type="submit" disabled={!username.trim() || !password || reqLoading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-600/20 active:scale-[0.98]">
              {reqLoading ? t("auth.submitting") : t("auth.submitRequest")}
            </button>
            <div className="text-center pt-1">
              <button type="button" onClick={() => { setMode("login"); setReqError(""); }}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> {t("auth.backToSignIn")}
              </button>
            </div>
          </form>
        )}

        {/* ── Request Submitted ── */}
        {mode === "requested" && (
          <div className="text-center space-y-4 animate-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <div>
              <p className="text-sm text-slate-300">{t("auth.requestSubmittedMsg")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("auth.requestReviewMsg")}</p>
            </div>
            <button onClick={() => { setMode("login"); setUsername(""); setPassword(""); }}
              className="text-xs text-blue-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1 mx-auto">
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
