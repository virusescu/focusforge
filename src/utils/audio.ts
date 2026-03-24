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
}

export const soundEngine = new SoundEngine();
