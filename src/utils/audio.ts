/**
 * Web Audio API based sound synthesizer for HUD interactions.
 * Generates synthetic UI sounds without external assets.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createOscillator(type: OscillatorType, freq: number, duration: number, volume: number = 0.1) {
    const ctx = this.init();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    return { osc, gain, ctx };
  }

  playStart() {
    const { osc, ctx } = this.createOscillator('sine', 440, 0.2, 0.1);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playPause() {
    const { osc, ctx } = this.createOscillator('sine', 660, 0.3, 0.08);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playReboot() {
    const ctx = this.init();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.02, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    playTone(880, 0, 0.1);
    playTone(440, 0.1, 0.1);
    playTone(220, 0.2, 0.3);
  }

  playClick() {
    const { osc, ctx } = this.createOscillator('sine', 1200, 0.05, 0.05);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  playHover() {
    const { osc, ctx } = this.createOscillator('sine', 1800, 0.03, 0.02);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }

  playKey() {
    const { osc, ctx } = this.createOscillator('sine', 1000, 0.02, 0.03);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  }

  playDenied() {
    const { osc, ctx } = this.createOscillator('square', 150, 0.2, 0.05);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playTab() {
    const { osc, ctx } = this.createOscillator('sine', 1500, 0.05, 0.04);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  playBoom() {
    const ctx = this.init();
    const t = ctx.currentTime;

    // ── Sub-bass thud ──────────────────────────────────
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    subGain.gain.setValueAtTime(0, t);
    subGain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(t);
    sub.stop(t + 0.65);

    // ── Mid punch crack ────────────────────────────────
    const punch = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punch.type = 'square';
    punch.frequency.setValueAtTime(220, t);
    punch.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    punchGain.gain.setValueAtTime(0, t);
    punchGain.gain.linearRampToValueAtTime(0.2, t + 0.005);
    punchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    punch.connect(punchGain);
    punchGain.connect(ctx.destination);
    punch.start(t);
    punch.stop(t + 0.2);

    // ── Noise burst (impact crack) ─────────────────────
    const bufSize = Math.floor(ctx.sampleRate * 0.12);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    // High-pass to keep it as a sharp crack, not rumble
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1200;
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    noiseSource.connect(hpf);
    hpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(t);
    noiseSource.stop(t + 0.12);

    // ── Short metallic ring (presence) ────────────────
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(600, t + 0.02);
    ringGain.gain.setValueAtTime(0.07, t + 0.02);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);
    ring.start(t + 0.02);
    ring.stop(t + 0.38);
  }

  playNeutralizeChime() {
    const ctx = this.init();
    const playTone = (freqStart: number, freqEnd: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime + start);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + start + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    // Rising high-freq chime sequence
    playTone(880, 1760, 0, 0.1, 0.08);
    playTone(1320, 2640, 0.05, 0.15, 0.06);
    playTone(1760, 3520, 0.1, 0.2, 0.04);
  }
}

export const soundEngine = new SoundEngine();
export const playNeutralizeChime = () => soundEngine.playNeutralizeChime();
export const playBoom = () => soundEngine.playBoom();

export async function playObjectiveComplete(): Promise<void> {
  try {
    const audio = new Audio('/sounds/objective-complete.mp3');
    audio.volume = 0.85;
    await audio.play();
  } catch {
    soundEngine.playBoom();
  }
}
