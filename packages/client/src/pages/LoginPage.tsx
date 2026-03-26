import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password) {
      await login(username.trim(), password);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/8 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[380px] p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30 mb-5">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">TimeBox</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            {mode === "login" && "Sign in to continue"}
            {mode === "request" && "Request an account"}
            {mode === "requested" && "Request submitted!"}
          </p>
        </div>

        {/* ── Login Form ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            {error && (
              <div className="text-red-400 text-xs text-center py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in">{error}</div>
            )}
            <button type="submit" disabled={!username.trim() || !password || loading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-[0.98] mt-2">
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setMode("request"); setUsername(""); setPassword(""); setReqError(""); }}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                Don't have an account? <span className="text-blue-500 font-medium">Request Access</span>
              </button>
            </div>
          </form>
        )}

        {/* ── Request Access Form ── */}
        {mode === "request" && (
          <form onSubmit={handleRequest} className="space-y-4 animate-in">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Display Name <span className="normal-case text-slate-600">(optional)</span></label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block tracking-wide uppercase">Message to Admin <span className="normal-case text-slate-600">(optional)</span></label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you'd like access..."
                rows={2}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all resize-none" />
            </div>
            {reqError && (
              <div className="text-red-400 text-xs text-center py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in">{reqError}</div>
            )}
            <button type="submit" disabled={!username.trim() || !password || reqLoading}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-600/20 active:scale-[0.98]">
              {reqLoading ? "Submitting..." : "Submit Request"}
            </button>
            <div className="text-center pt-1">
              <button type="button" onClick={() => { setMode("login"); setReqError(""); }}
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
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
              <p className="text-sm text-slate-300">Your request has been submitted.</p>
              <p className="text-xs text-slate-500 mt-1">An admin will review your request. Once approved, you can sign in with your credentials.</p>
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
