import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, REGISTRY, SCENES } from '../config/constants.js';
import { ALL_ITEMS, EXTRA_IMAGE_KEYS } from '../config/items.js';
import { generatePlaceholderTextures } from '../utils/placeholders.js';
import { api } from '../services/api.js';

/**
 * PreloadScene: loads assets with a visible progress bar, then generates
 * placeholder textures for any missing images and fetches public config.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Preload);
  }

  preload(): void {
    this.buildProgressBar();

    // Attempt to load real images. Missing files are tolerated: Phaser emits
    // a load error which we catch, and placeholders are generated afterwards.
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // Silently ignore missing optional assets.
      console.warn(`Asset opcional no encontrado: ${file.key}`);
    });

    const imageBase = 'assets/images';
    const assetVersion = 'transparent-20260721';
    for (const item of ALL_ITEMS) {
      this.load.image(item.key, `${imageBase}/${item.key}.png?v=${assetVersion}`);
    }
    for (const key of EXTRA_IMAGE_KEYS) {
      this.load.image(key, `${imageBase}/${key}.png?v=${assetVersion}`);
    }
  }

  async create(): Promise<void> {
    // Generate placeholders for any image that did not load.
    generatePlaceholderTextures(this);

    // Fetch public configuration (falls back to defaults if offline).
    const config = await api.getPublicConfig();
    this.registry.set(REGISTRY.publicConfig, config);

    // Hide the HTML loading screen now that Phaser is ready.
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen?.classList.add('hidden');

    // Recompute canvas bounds so pointer input aligns after the layout settles.
    this.scale.refresh();

    this.scene.start(SCENES.Menu);
  }

  private buildProgressBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 120, 'DADDY GAME CHICKEN', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '44px',
        color: '#ffd21e',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);

    const barWidth = 460;
    const barHeight = 40;
    const box = this.add.graphics();
    box.lineStyle(4, COLORS.yellow, 1);
    box.strokeRoundedRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, 12);

    const bar = this.add.graphics();
    const label = this.add
      .text(cx, cy + 60, 'Cargando… 0%', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(COLORS.neon, 1);
      bar.fillRoundedRect(
        cx - barWidth / 2 + 6,
        cy - barHeight / 2 + 6,
        (barWidth - 12) * value,
        barHeight - 12,
        8,
      );
      label.setText(`Cargando… ${Math.round(value * 100)}%`);
    });
  }
}
