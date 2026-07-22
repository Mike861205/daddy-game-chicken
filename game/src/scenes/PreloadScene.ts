import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants.js';
import { ALL_ITEMS, EXTRA_IMAGE_KEYS } from '../config/items.js';
import { generatePlaceholderTextures } from '../utils/placeholders.js';
import { api } from '../services/api.js';

/**
 * Loads game assets behind a six-second branded cinematic intro.
 */
export class PreloadScene extends Phaser.Scene {
  private static readonly INTRO_DURATION_MS = 6000;
  private introStartedAt = 0;
  private progressAnimationFrame = 0;

  constructor() {
    super(SCENES.Preload);
  }

  preload(): void {
    this.introStartedAt = performance.now();
    this.animateHtmlProgress();

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Asset opcional no encontrado: ${file.key}`);
    });

    const imageBase = 'assets/images';
    const assetVersion = 'neon-intro-20260722';
    this.load.spritesheet(
      'daddy-pollo-anim',
      `${imageBase}/daddy-pollo-anim.png?v=${assetVersion}`,
      { frameWidth: 512, frameHeight: 512 },
    );
    this.load.spritesheet(
      'enemigos-anim',
      `${imageBase}/enemigos-anim.png?v=${assetVersion}`,
      { frameWidth: 512, frameHeight: 512 },
    );
    for (const item of ALL_ITEMS) {
      this.load.image(item.key, `${imageBase}/${item.key}.png?v=${assetVersion}`);
    }
    for (const key of EXTRA_IMAGE_KEYS) {
      this.load.image(key, `${imageBase}/${key}.png?v=${assetVersion}`);
    }
  }

  async create(): Promise<void> {
    generatePlaceholderTextures(this);

    const config = await api.getPublicConfig();
    this.registry.set(REGISTRY.publicConfig, config);

    const elapsed = performance.now() - this.introStartedAt;
    const remaining = Math.max(0, PreloadScene.INTRO_DURATION_MS - elapsed);
    await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
    window.cancelAnimationFrame(this.progressAnimationFrame);
    this.updateHtmlProgress(1);

    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen?.classList.add('hidden');
    window.setTimeout(() => loadingScreen?.remove(), 650);

    this.scale.refresh();
    this.scene.start(SCENES.Menu);
  }

  private animateHtmlProgress(): void {
    const tick = (): void => {
      const elapsed = performance.now() - this.introStartedAt;
      const progress = Phaser.Math.Clamp(elapsed / PreloadScene.INTRO_DURATION_MS, 0, 1);
      this.updateHtmlProgress(progress);
      if (progress < 1) {
        this.progressAnimationFrame = window.requestAnimationFrame(tick);
      }
    };
    tick();
  }

  private updateHtmlProgress(progress: number): void {
    const percentage = Math.round(progress * 100);
    const bar = document.querySelector<HTMLElement>('.loading-bar');
    const fill = document.querySelector<HTMLElement>('.loading-bar > span');
    const percent = document.querySelector<HTMLElement>('.loading-percent');
    const label = document.querySelector<HTMLElement>('.loading-text');
    fill?.style.setProperty('--loading-progress', `${percentage}%`);
    bar?.setAttribute('aria-valuenow', String(percentage));
    if (percent) {
      percent.textContent = `${percentage}%`;
    }
    if (label) {
      label.textContent = progress < 0.22
        ? 'ENCENDIENDO EL NEÓN'
        : progress < 0.48
          ? 'CARGANDO EL ARSENAL'
          : progress < 0.74
            ? 'ACTIVANDO PODERES'
            : progress < 0.96
              ? 'ABRIENDO LA ARENA'
              : '¡TODO LISTO!';
    }
  }
}
