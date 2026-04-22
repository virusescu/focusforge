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

  playChargeClick(step: number) {
    const ctx = this.init();
    const t = ctx.currentTime;

    const configs: [number, number, number][] = [
      [300,  500,  0.060], // step 1 – low tick
      [500,  800,  0.065], // step 2 – brighter
      [800,  1200, 0.070], // step 3 – crisp
      [1200, 1800, 0.075], // step 4 – sharp
      [1800, 2800, 0.080], // step 5 – high, snappy
    ];

    const idx = Math.max(0, Math.min(4, step - 1));
    const [freqStart, freqEnd, dur] = configs[idx];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
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

  // ─── Game Economy Sounds ──────────────────────────────────────

  playCoinEarned() {
    const ctx = this.init();
    const t = ctx.currentTime;

    // Two stacked sine oscillators for metallic chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, t);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1800, t);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.08);
    osc2.stop(t + 0.08);
  }

  playPurchase() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + start);
      gain.gain.setValueAtTime(0.05, t + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + dur);
    };
    playTone(880, 0, 0.1);
    playTone(660, 0.08, 0.12);
  }

  playStreakMilestone() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const notes = [440, 550, 660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      gain.gain.setValueAtTime(0.08, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.1);
    });
  }

  playDailyBonusUnlocked() {
    const ctx = this.init();
    const t = ctx.currentTime;
    [1000, 1500].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.07, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.05);
    });
  }

  playDetailsOpen() {
    const ctx = this.init();
    const t = ctx.currentTime;
    // Soft rising two-tone sweep — panel sliding in
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + i * 0.04 + 0.12);
      gain.gain.setValueAtTime(0.05, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.2);
    });
  }

  playDetailsClose() {
    const ctx = this.init();
    const t = ctx.currentTime;
    // Mirror of open — descending sweep
    [660, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.67, t + i * 0.04 + 0.12);
      gain.gain.setValueAtTime(0.04, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.18);
    });
  }

  playReorder() {
    const ctx = this.init();
    const t = ctx.currentTime;
    // Short tick then a soft thud
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(1400, t);
    tick.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    tickGain.gain.setValueAtTime(0.06, t);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    tick.connect(tickGain);
    tickGain.connect(ctx.destination);
    tick.start(t);
    tick.stop(t + 0.06);

    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(200, t + 0.04);
    thud.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    thudGain.gain.setValueAtTime(0.08, t + 0.04);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(t + 0.04);
    thud.stop(t + 0.15);
  }

  playEditStart() {
    const ctx = this.init();
    const t = ctx.currentTime;
    // Double-click feel: two quick high taps
    [0, 0.07].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600, t + delay);
      osc.frequency.exponentialRampToValueAtTime(1200, t + delay + 0.05);
      gain.gain.setValueAtTime(0.055, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.07);
    });
  }

  playNavSelect() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.04);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playObjectiveAdded() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const playTone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + start + dur);
      gain.gain.setValueAtTime(vol, t + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + dur + 0.01);
    };
    playTone(440, 0, 0.1, 0.07);
    playTone(660, 0.05, 0.15, 0.05);
  }

  playCheckboxCheck() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const playTone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, t + start + dur);
      gain.gain.setValueAtTime(vol, t + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + dur + 0.01);
    };
    playTone(660, 0, 0.07, 0.07);
    playTone(990, 0.06, 0.12, 0.05);
    playTone(1320, 0.14, 0.1, 0.035);
  }

  playCheckboxUncheck() {
    const ctx = this.init();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.07);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playSeasonComplete() {
    const ctx = this.init();
    const t = ctx.currentTime;

    // Chord: 440 + 660 + 880 with swell
    [440, 660, 880].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.5);
      gain.gain.setValueAtTime(0.1, t + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    });

    // Sub-bass hit
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, t);
    subGain.gain.setValueAtTime(0, t);
    subGain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(t);
    sub.stop(t + 0.8);
  }
}

export const soundEngine = new SoundEngine();
export const playNeutralizeChime = () => soundEngine.playNeutralizeChime();
export const playBoom = () => soundEngine.playBoom();

export async function playObjectiveComplete(): Promise<void> {
  try {
    const count = await probeSoundCount('objective-complete');
    if (count === 0) { soundEngine.playBoom(); return; }
    const soundIndex = Math.floor(Math.random() * count) + 1;
    const audio = new Audio(`/sounds/objective-complete-${soundIndex}.mp3`);
    audio.volume = 0.8 + Math.random() * 0.15;
    audio.playbackRate = 0.95 + Math.random() * 0.1;
    await audio.play();
  } catch (e) {
    console.error('Failed to play reward sound:', e);
    soundEngine.playBoom();
  }
}

// Cached counts — probed once per session by HEAD request
const soundCounts: Record<string, number> = {};

async function probeSoundCount(prefix: string, max = 6): Promise<number> {
  if (soundCounts[prefix] !== undefined) return soundCounts[prefix];
  let count = 0;
  for (let i = 1; i <= max; i++) {
    try {
      const res = await fetch(`/sounds/${prefix}-${i}.mp3`, { method: 'HEAD' });
      if (!res.ok) break;
      count = i;
    } catch {
      break;
    }
  }
  soundCounts[prefix] = count;
  return count;
}

export async function playCheckboxCheckWithFile(): Promise<void> {
  try {
    const count = await probeSoundCount('checkbox-check');
    if (count === 0) { soundEngine.playCheckboxCheck(); return; }
    const soundIndex = Math.floor(Math.random() * count) + 1;
    const audio = new Audio(`/sounds/checkbox-check-${soundIndex}.mp3`);
    audio.volume = 0.8 + Math.random() * 0.15;
    audio.playbackRate = 0.95 + Math.random() * 0.1;
    await audio.play();
  } catch {
    soundEngine.playCheckboxCheck();
  }
}

export async function playAlarmFile(): Promise<HTMLAudioElement> {
  const audio = new Audio('/sounds/alarm.mp3');
  audio.loop = true;
  audio.volume = 1.0;
  await audio.play();
  return audio;
}

export async function playChargeClickWithFile(step: number): Promise<void> {
  try {
    const audio = new Audio(`./sounds/charge-${step}.mp3`);
    audio.volume = 0.75;
    await audio.play();
  } catch {
    soundEngine.playChargeClick(step);
  }
}
