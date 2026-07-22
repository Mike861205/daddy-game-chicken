import { storage } from './storage.js';

type SoundName = 'catch' | 'error' | 'combo' | 'power' | 'countdown' | 'win' | 'click';

/**
 * Lightweight audio manager using the Web Audio API to synthesize simple
 * sound effects. This avoids requiring binary audio assets while still
 * providing feedback. Real audio files can be added later.
 *
 * Respects browser autoplay policies: the AudioContext is only created /
 * resumed after a user gesture.
 */
class AudioManager {
  private context: AudioContext | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = storage.getSoundEnabled();
  }

  /** Must be called from a user gesture handler to satisfy autoplay policies. */
  unlock(): void {
    if (!this.context) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.context = new Ctx();
      } catch {
        this.context = null;
      }
    }
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    storage.setSoundEnabled(enabled);
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.context) {
      return;
    }
    const presets: Record<SoundName, { freq: number; type: OscillatorType; duration: number; sweep?: number }> = {
      catch: { freq: 660, type: 'sine', duration: 0.12, sweep: 880 },
      error: { freq: 160, type: 'sawtooth', duration: 0.25, sweep: 80 },
      combo: { freq: 520, type: 'square', duration: 0.18, sweep: 1040 },
      power: { freq: 440, type: 'triangle', duration: 0.3, sweep: 990 },
      countdown: { freq: 700, type: 'square', duration: 0.1 },
      win: { freq: 523, type: 'sine', duration: 0.5, sweep: 1046 },
      click: { freq: 400, type: 'sine', duration: 0.06 },
    };
    const preset = presets[name];
    this.tone(preset.freq, preset.type, preset.duration, preset.sweep);
  }

  private tone(freq: number, type: OscillatorType, duration: number, sweepTo?: number): void {
    if (!this.context) {
      return;
    }
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }
}

export const audioManager = new AudioManager();
