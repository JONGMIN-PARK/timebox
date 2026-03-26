import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const { login, loading, error } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 4) {
      await login(pin);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TimeBox</h1>
          <p className="text-slate-400 mt-2">PIN을 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin.length > i
                    ? "border-blue-500 bg-blue-500/20 text-white"
                    : "border-slate-600 bg-slate-800 text-slate-500"
                }`}
              >
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>

          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="sr-only"
            autoFocus
          />

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((key, i) => {
              if (key === null) return <div key={i} />;
              return (
                <button
                  key={i}
                  type={key === "del" ? "button" : "button"}
                  onClick={() => {
                    if (key === "del") {
                      setPin((p) => p.slice(0, -1));
                    } else {
                      setPin((p) => (p + key).slice(0, 8));
                    }
                  }}
                  className="h-14 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-xl font-semibold transition-colors"
                >
                  {key === "del" ? "⌫" : key}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors"
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
