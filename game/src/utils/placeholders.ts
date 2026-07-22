import Phaser from 'phaser';
import { ALL_ITEMS, EXTRA_IMAGE_KEYS } from '../config/items.js';
import { COLORS } from '../config/constants.js';

/**
 * Generate placeholder textures for any item image that failed to load.
 * This guarantees the game never breaks when a real asset is missing.
 * Each placeholder is a rounded rectangle with the item's color and a short
 * label so it is clearly identifiable.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const size = 96;

  for (const item of ALL_ITEMS) {
    if (scene.textures.exists(item.key)) {
      continue;
    }
    createPlaceholder(scene, item.key, item.color, shortLabel(item.label), size);
  }

  // Player placeholder.
  if (!scene.textures.exists('daddy-pollo')) {
    createPlaceholder(scene, 'daddy-pollo', COLORS.yellow, 'DADDY', 120);
  }

  // Logo placeholder.
  if (!scene.textures.exists('logo-daddy-game-chicken')) {
    createLogoPlaceholder(scene);
  }

  // Background is handled by scenes directly (solid gradient), so we only
  // ensure an existence check for any other extra images.
  for (const key of EXTRA_IMAGE_KEYS) {
    if (key === 'fondo-los-cabos') {
      continue;
    }
    if (!scene.textures.exists(key) && key !== 'logo-daddy-game-chicken' && key !== 'daddy-pollo') {
      createPlaceholder(scene, key, COLORS.blueLight, shortLabel(key), size);
    }
  }
}

function shortLabel(label: string): string {
  const words = label.split(/[\s-]+/u);
  if (words.length === 1) {
    return words[0].slice(0, 6).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function createPlaceholder(
  scene: Phaser.Scene,
  key: string,
  color: number,
  label: string,
  size: number,
): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0x000000, 0.25);
  gfx.fillRoundedRect(4, 6, size - 8, size - 8, 16);
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(2, 2, size - 8, size - 8, 16);
  gfx.lineStyle(3, 0xffffff, 0.85);
  gfx.strokeRoundedRect(2, 2, size - 8, size - 8, 16);
  gfx.generateTexture(key, size, size);
  gfx.destroy();

  // Overlay label as a separate texture is complex; instead we bake text
  // using a RenderTexture.
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: size, height: size }, false);
  rt.draw(scene.add.image(size / 2, size / 2, key).setOrigin(0.5));
  const text = scene.make.text(
    {
      x: size / 2,
      y: size / 2,
      text: label,
      style: {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: label.length > 3 ? '20px' : '26px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      },
    },
    false,
  );
  text.setOrigin(0.5);
  rt.draw(text, size / 2, size / 2);
  rt.saveTexture(key);
  text.destroy();
  rt.destroy();
}

function createLogoPlaceholder(scene: Phaser.Scene): void {
  const width = 560;
  const height = 200;
  const rt = scene.make.renderTexture({ x: 0, y: 0, width, height }, false);
  const bg = scene.make.graphics({ x: 0, y: 0 }, false);
  bg.fillStyle(COLORS.blue, 1);
  bg.fillRoundedRect(0, 0, width, height, 24);
  bg.lineStyle(6, COLORS.yellow, 1);
  bg.strokeRoundedRect(3, 3, width - 6, height - 6, 22);
  rt.draw(bg);
  bg.destroy();

  const title = scene.make.text(
    {
      x: width / 2,
      y: height / 2 - 30,
      text: 'DADDY GAME',
      style: {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '56px',
        color: '#ffd21e',
        stroke: '#000000',
        strokeThickness: 6,
      },
    },
    false,
  );
  title.setOrigin(0.5);
  const subtitle = scene.make.text(
    {
      x: width / 2,
      y: height / 2 + 40,
      text: 'CHICKEN',
      style: {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '56px',
        color: '#e6262b',
        stroke: '#ffffff',
        strokeThickness: 6,
      },
    },
    false,
  );
  subtitle.setOrigin(0.5);
  rt.draw(title);
  rt.draw(subtitle);
  title.destroy();
  subtitle.destroy();
  rt.saveTexture('logo-daddy-game-chicken');
  rt.destroy();
}
