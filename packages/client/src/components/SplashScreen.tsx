import { useState, useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  // 0: logo appears (scale up from 0.6)
  // 1: logo settles + text fades in
  // 2: logo zooms out massively + entire screen fades to white/transparent

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => onComplete(), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        overflow: "hidden",
        opacity: phase >= 2 ? 0 : 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: "translate(-50%, -50%)", width: "500px", height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
        filter: "blur(60px)", pointerEvents: "none",
      }} />

      {/* Logo + Text container - zooms out on phase 2 */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        transform: phase === 0 ? "scale(0.6)" : phase === 1 ? "scale(1)" : "scale(30)",
        opacity: phase === 0 ? 0 : phase === 1 ? 1 : 0,
        transition: phase === 2
          ? "transform 0.5s cubic-bezier(0.4, 0, 1, 1), opacity 0.4s ease-out"
          : "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-in",
      }}>
        {/* Logo SVG */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="36" stroke="url(#logoGrad)" strokeWidth="3" fill="none" opacity="0.9" />
          <circle cx="40" cy="40" r="32" fill="rgba(15,23,42,0.6)" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line key={deg} x1="40" y1="10" x2="40" y2="14" stroke="rgba(148,163,184,0.5)"
              strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${deg} 40 40)`} />
          ))}
          <line x1="40" y1="40" x2="40" y2="22" stroke="white" strokeWidth="2.5"
            strokeLinecap="round" transform="rotate(-30 40 40)" />
          <line x1="40" y1="40" x2="40" y2="16" stroke="url(#handGrad)" strokeWidth="2"
            strokeLinecap="round" transform="rotate(60 40 40)" />
          <circle cx="40" cy="40" r="3" fill="url(#logoGrad)" />
          <path d="M40 8 A32 32 0 0 1 72 40" stroke="rgba(59,130,246,0.3)" strokeWidth="2" fill="none" strokeDasharray="4 6" />
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="80" y2="80">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="handGrad" x1="40" y1="40" x2="40" y2="16">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        {/* App name */}
        <div style={{
          marginTop: "20px",
          fontSize: "1.8rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          background: "linear-gradient(90deg, #60a5fa, #a78bfa, #60a5fa)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: phase >= 1 ? "splashShimmer 2s linear infinite" : "none",
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 0.4s ease-in 0.1s",
        }}>
          TimeBox
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: "48px", left: "50%",
        transform: "translateX(-50%)", width: "120px", height: "2px",
        borderRadius: "1px", background: "rgba(30, 41, 59, 0.8)",
        overflow: "hidden",
        opacity: phase >= 2 ? 0 : 0.8,
        transition: "opacity 0.3s",
      }}>
        <div className="splash-progress" style={{
          height: "100%", borderRadius: "1px",
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
        }} />
      </div>
    </div>
  );
}
