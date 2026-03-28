import { useState, useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0); // 0=initial, 1=text, 2=tagline, 3=fade-out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => onComplete(), 2300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div
      className={`splash-screen ${phase >= 3 ? "splash-fade-out" : ""}`}
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
      }}
    >
      {/* Ambient glow circles */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "20%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      {/* Logo container */}
      <div className={`splash-logo ${phase >= 1 ? "splash-logo-visible" : ""}`}>
        <div className="splash-logo-glow" />
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Clock outer ring */}
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="url(#logoGradient)"
            strokeWidth="3"
            fill="none"
            opacity="0.9"
          />
          {/* Inner circle fill */}
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="rgba(15,23,42,0.6)"
          />
          {/* Hour marks */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="40"
              y1="10"
              x2="40"
              y2="14"
              stroke="rgba(148,163,184,0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${deg} 40 40)`}
            />
          ))}
          {/* Hour hand */}
          <line
            x1="40"
            y1="40"
            x2="40"
            y2="22"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform="rotate(-30 40 40)"
          />
          {/* Minute hand */}
          <line
            x1="40"
            y1="40"
            x2="40"
            y2="16"
            stroke="url(#handGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(60 40 40)"
          />
          {/* Center dot */}
          <circle cx="40" cy="40" r="3" fill="url(#logoGradient)" />
          {/* Timebox segments (quarter arcs) */}
          <path
            d="M40 8 A32 32 0 0 1 72 40"
            stroke="rgba(59,130,246,0.3)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 6"
          />
          <path
            d="M72 40 A32 32 0 0 1 40 72"
            stroke="rgba(139,92,246,0.2)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 6"
          />
          <defs>
            <linearGradient id="logoGradient" x1="0" y1="0" x2="80" y2="80">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="handGradient" x1="40" y1="40" x2="40" y2="16">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* App name */}
      <div
        className={`splash-text ${phase >= 1 ? "splash-text-visible" : ""}`}
        style={{
          marginTop: "24px",
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          background: "linear-gradient(90deg, #60a5fa, #a78bfa, #60a5fa, #a78bfa)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: phase >= 1 ? "splashShimmer 2s linear infinite" : "none",
        }}
      >
        TimeBox
      </div>

      {/* Tagline */}
      <div
        className={`splash-tagline ${phase >= 2 ? "splash-tagline-visible" : ""}`}
        style={{
          marginTop: "12px",
          fontSize: "0.875rem",
          color: "rgba(148, 163, 184, 0.8)",
          letterSpacing: "0.2em",
          fontWeight: 300,
        }}
      >
        Your Time, Your Way
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120px",
          height: "2px",
          borderRadius: "1px",
          background: "rgba(30, 41, 59, 0.8)",
          overflow: "hidden",
        }}
      >
        <div
          className="splash-progress"
          style={{
            height: "100%",
            borderRadius: "1px",
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
          }}
        />
      </div>
    </div>
  );
}
