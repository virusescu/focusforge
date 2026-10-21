import { describe, it, expect, vi, beforeEach } from 'vitest';

// A stand-in for HTMLAudioElement that records pause() and lets a test end playback
class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  paused = true;
  private listeners: Record<string, Array<() => void>> = {};
  src: string;
  constructor(src = '') { this.src = src; FakeAudio.instances.push(this); }
  load() {}
  cloneNode() { return new FakeAudio(this.src); }
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.listeners.ended?.forEach(fn => fn()); }
}

vi.stubGlobal('Audio', FakeAudio);
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

const { playStartSound, playObjectiveComplete } = await import('./audio');
const lastPlaying = () => FakeAudio.instances.filter(a => !a.paused);

describe('long sounds share one channel', () => {
  beforeEach(() => {
    FakeAudio.instances.forEach(a => a.pause());
  });

  it('a new activation cuts off the previous one', async () => {
    playStartSound();
    await Promise.resolve();
    const first = lastPlaying()[0];
    playStartSound();
    await Promise.resolve();
    expect(first.paused).toBe(true);
    expect(first.currentTime).toBe(0);
    expect(lastPlaying()).toHaveLength(1);
  });

  it('a sound that already ended is not touched when the next one starts', async () => {
    playStartSound();
    await Promise.resolve();
    const first = lastPlaying()[0];
    first.end();
    const pause = vi.spyOn(first, 'pause');
    playStartSound();
    await Promise.resolve();
    expect(pause).not.toHaveBeenCalled();
  });

  it('completing an objective cuts off an activation sound that is still playing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    playStartSound();
    await Promise.resolve();
    const start = lastPlaying()[0];
    await playObjectiveComplete();
    expect(start.paused).toBe(true);
    expect(lastPlaying()).toHaveLength(1);
  });
});
