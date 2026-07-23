import { storage } from './storage.js';

type SoundName =
  | 'catch'
  | 'error'
  | 'combo'
  | 'power'
  | 'countdown'
  | 'win'
  | 'click'
  | 'shot'
  | 'blast'
  | 'enemy';

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
  private readonly music: HTMLAudioElement;
  private playbackRequest = 0;
  private enabled: boolean;
  private firstGestureBound = false;

  constructor() {
    this.enabled = storage.getSoundEnabled();
    this.music = new Audio('/assets/audio/musica-fondo.mp3?v=20260721');
    this.music.loop = true;
    this.music.autoplay = this.enabled;
    this.music.preload = 'auto';
    this.music.volume = 0.28;
    this.music.setAttribute('playsinline', '');

    // Browsers that permit autoplay start immediately. When autoplay is
    // blocked, any first interaction (including during the loading cinematic)
    // unlocks it automatically. The visitor never has to press the sound
    // preference button just to begin playback.
    if (this.enabled) {
      this.startMusic();
    }
    this.bindFirstGestureUnlock();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled) {
        this.startMusic();
      }
    });
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
    this.startMusic();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    storage.setSoundEnabled(enabled);
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
      if (this.context?.state === 'running') {
        void this.context.suspend();
      }
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private bindFirstGestureUnlock(): void {
    if (this.firstGestureBound) {
      return;
    }
    this.firstGestureBound = true;

    const unlockFromGesture = (): void => {
      document.removeEventListener('pointerdown', unlockFromGesture, true);
      document.removeEventListener('touchstart', unlockFromGesture, true);
      document.removeEventListener('keydown', unlockFromGesture, true);
      this.firstGestureBound = false;
      this.unlock();
    };

    // Capture phase ensures the audio permission is obtained before Phaser or
    // a form consumes the same interaction.
    document.addEventListener('pointerdown', unlockFromGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener('touchstart', unlockFromGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener('keydown', unlockFromGesture, true);
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
      shot: { freq: 820, type: 'square', duration: 0.08, sweep: 360 },
      blast: { freq: 180, type: 'sawtooth', duration: 0.2, sweep: 70 },
      enemy: { freq: 260, type: 'triangle', duration: 0.16, sweep: 520 },
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

  private startMusic(): void {
    if (!this.enabled) {
      return;
    }
    this.music.muted = false;
    if (!this.music.paused) {
      return;
    }
    this.playbackRequest += 1;
    const request = this.playbackRequest;
    const playback = this.music.play();
    if (playback) {
      void playback
        .then(() => {
          // A play() promise can resolve after the visitor already selected NO.
          // Re-check state so a late autoplay response cannot restart the track.
          if (!this.enabled || request !== this.playbackRequest) {
            this.stopMusic();
          }
        })
        .catch(() => {
          // Autoplay blocked: the next unlock() call retries after interaction.
        });
    }
  }

  private stopMusic(): void {
    this.playbackRequest += 1;
    this.music.muted = true;
    this.music.pause();
    this.music.currentTime = 0;
  }
}

export const audioManager = new AudioManager();
