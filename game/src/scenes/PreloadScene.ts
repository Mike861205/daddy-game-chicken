import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants.js';
import { ALL_ITEMS, EXTRA_IMAGE_KEYS } from '../config/items.js';
import { generatePlaceholderTextures } from '../utils/placeholders.js';
import { api } from '../services/api.js';
import { WORLDS } from '../config/worlds.js';

/**
 * Loads game assets behind a branded cinematic that previews all eight worlds.
 */
export class PreloadScene extends Phaser.Scene {
  private static readonly INTRO_DURATION_MS = 8800;
  private introStartedAt = 0;
  private progressAnimationFrame = 0;
  private introWorldIndex = -1;

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
    const assetVersion = 'combat-bike-20260723';
    this.load.spritesheet(
      'daddy-pollo-anim',
      `${imageBase}/daddy-pollo-anim.png?v=${assetVersion}`,
      { frameWidth: 512, frameHeight: 512 },
    );
    this.load.spritesheet(
      'daddy-pollo-armed-anim',
      `${imageBase}/daddy-pollo-armed-anim.png?v=${assetVersion}`,
      { frameWidth: 512, frameHeight: 512 },
    );
    this.load.spritesheet(
      'enemigos-anim',
      `${imageBase}/enemigos-anim.png?v=${assetVersion}`,
      { frameWidth: 512, frameHeight: 512 },
    );
    for (const world of WORLDS) {
      this.load.image(
        world.backgroundKey,
        `${imageBase}/${world.backgroundKey}.jpg?v=${assetVersion}`,
      );
      this.load.image(
        world.bossTexture,
        `${imageBase}/${world.bossTexture}.png?v=${assetVersion}`,
      );
      if (world.secondaryBossTexture) {
        this.load.image(
          world.secondaryBossTexture,
          `${imageBase}/${world.secondaryBossTexture}.png?v=${assetVersion}`,
        );
      }
    }
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
    const activeWorldIndex = Math.min(
      WORLDS.length - 1,
      Math.floor(progress * WORLDS.length),
    );
    const bar = document.querySelector<HTMLElement>('.loading-bar');
    const fill = document.querySelector<HTMLElement>('.loading-bar > span');
    const percent = document.querySelector<HTMLElement>('.loading-percent');
    const label = document.querySelector<HTMLElement>('.loading-text');
    const stage = document.querySelector<HTMLElement>('.intro-stage');
    const runner = document.querySelector<HTMLElement>('.intro-runner');
    const bossPortal = document.querySelector<HTMLElement>('.intro-boss-portal');
    const bosses = [...document.querySelectorAll<HTMLElement>('.intro-boss')];
    const bossLabel = document.querySelector<HTMLElement>('.intro-boss-label strong');
    fill?.style.setProperty('--loading-progress', `${percentage}%`);
    bar?.setAttribute('aria-valuenow', String(percentage));
    if (percent) {
      percent.textContent = `${percentage}%`;
    }
    if (label) {
      label.textContent = progress < 0.1
        ? 'ENCENDIENDO EL NEÓN'
        : progress < 0.98
          ? `RASTREANDO ${WORLDS[activeWorldIndex].name.toUpperCase()}`
          : '¡MISIÓN LISTA!';
    }

    // The runner is driven by the exact same progress value as the bar so Daddy
    // reaches the finish line with the last encounter instead of arriving early.
    if (stage && runner) {
      const ridingBike = progress < 0.5;
      runner.classList.toggle('is-bike-phase', ridingBike);
      runner.classList.toggle('is-running-phase', !ridingBike);
      const runnerWidth = runner.getBoundingClientRect().width;
      const startX = -runnerWidth * 0.58;
      const endX = stage.clientWidth - runnerWidth * 0.78;
      const x = Phaser.Math.Linear(startX, endX, progress);
      const stride = Math.sin(progress * Math.PI * 12) * 2.5;
      const scale = 0.86 + Math.sin(progress * Math.PI) * 0.14;
      runner.style.left = '0px';
      runner.style.transform = `translate3d(${x}px, ${stride}px, 0) scale(${scale})`;
    }

    if (bosses.length > 0) {
      const activeBosses = bosses.filter(
        (boss) => Number(boss.dataset.worldIndex) === activeWorldIndex,
      );
      bosses.forEach((boss) => {
        boss.classList.toggle(
          'is-active',
          Number(boss.dataset.worldIndex) === activeWorldIndex,
        );
      });
      const bossOnLeft = activeWorldIndex % 2 === 1;
      bossPortal?.classList.toggle('is-left', bossOnLeft);
      bossPortal?.classList.toggle('is-right', !bossOnLeft);
      bossPortal?.classList.toggle('is-dual', activeBosses.length > 1);
      if (bossPortal && activeBosses[0]) {
        bossPortal.dataset.power = activeBosses[0].dataset.bossPower ?? 'fire';
        if (this.introWorldIndex !== activeWorldIndex) {
          bossPortal.classList.remove('is-swapping');
          void bossPortal.offsetWidth;
          bossPortal.classList.add('is-swapping');
          this.introWorldIndex = activeWorldIndex;
        }
      }
      if (bossLabel) {
        bossLabel.textContent = WORLDS[activeWorldIndex].bossName.toUpperCase();
      }
    }
  }
}
