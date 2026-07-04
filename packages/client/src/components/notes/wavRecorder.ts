/**
 * Web Audio based WAV recorder.
 *
 * iOS Safari's MediaRecorder is unreliable (timeslice quirks, empty blobs,
 * webm/mp4 container issues). Capturing PCM via the Web Audio API and encoding
 * a WAV in JS works consistently across Chrome/Android/iOS Safari, produces a
 * universally playable file, and is directly transcribable by Gemini (no
 * server-side transcode needed).
 */
export class WavRecorder {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private buffers: Float32Array[] = [];
  private length = 0;
  private inRate = 44100;

  constructor(private stream: MediaStream) {}

  /** Begin capturing. Must be called from a user gesture (iOS requirement). */
  async start(): Promise<void> {
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    // iOS starts the context suspended until resumed inside a gesture.
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.inRate = this.ctx.sampleRate;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessorNode is deprecated but universally supported (incl. iOS);
    // AudioWorklet would need a separately-loaded module.
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      this.buffers.push(new Float32Array(ch)); // copy — the event buffer is reused
      this.length += ch.length;
    };
    this.source.connect(this.processor);
    // The processor must be connected to the destination to run; it outputs
    // silence (we never write its output buffer), so there's no feedback.
    this.processor.connect(this.ctx.destination);
  }

  /** Stop and return the recorded audio as a 16kHz mono 16-bit WAV blob. */
  stop(): Blob {
    this.processor?.disconnect();
    this.source?.disconnect();
    const merged = this.merge();
    const OUT_RATE = 16000;
    const down = downsample(merged, this.inRate, OUT_RATE);
    const wav = encodeWav(down, OUT_RATE);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    return new Blob([wav], { type: "audio/wav" });
  }

  private merge(): Float32Array {
    const out = new Float32Array(this.length);
    let offset = 0;
    for (const b of this.buffers) {
      out.set(b, offset);
      offset += b.length;
    }
    return out;
  }
}

function downsample(buf: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return buf;
  const ratio = from / to;
  const outLen = Math.round(buf.length / ratio);
  const out = new Float32Array(outLen);
  let pos = 0;
  for (let i = 0; i < outLen; i++) {
    const next = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = pos; j < next && j < buf.length; j++) {
      sum += buf[j];
      count++;
    }
    out[i] = count ? sum / count : 0;
    pos = next;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buffer;
}
