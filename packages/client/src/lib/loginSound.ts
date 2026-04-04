/**
 * Inspiring login melody using Web Audio API.
 * A bright, uplifting 4-note chime that evokes "time to make today count."
 */
export function playLoginMelody() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    // C5 → E5 → G5 → C6  (ascending major arpeggio — uplifting & energetic)
    const notes = [
      { freq: 523.25, start: 0,    dur: 0.18 },  // C5
      { freq: 659.25, start: 0.12, dur: 0.18 },  // E5
      { freq: 783.99, start: 0.24, dur: 0.18 },  // G5
      { freq: 1046.5, start: 0.38, dur: 0.35 },  // C6 (longer ring)
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = n.freq;

      // Add shimmer with a quiet harmonic
      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.value = n.freq * 2;
      env2.gain.setValueAtTime(0, ctx.currentTime + n.start);
      env2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + n.start + 0.03);
      env2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
      osc2.connect(env2).connect(master);
      osc2.start(ctx.currentTime + n.start);
      osc2.stop(ctx.currentTime + n.start + n.dur + 0.05);

      // Main tone envelope: quick attack, smooth decay
      env.gain.setValueAtTime(0, ctx.currentTime + n.start);
      env.gain.linearRampToValueAtTime(1, ctx.currentTime + n.start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);

      osc.connect(env).connect(master);
      osc.start(ctx.currentTime + n.start);
      osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
    }

    // Clean up after melody finishes
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Silently fail — sound is non-critical
  }
}
