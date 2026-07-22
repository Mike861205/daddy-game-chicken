import Phaser from 'phaser';
import { COLORS, COLORS_HEX } from '../config/constants.js';
import { audioManager } from '../services/audio.js';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  fillColor?: number;
  textColor?: string;
  strokeColor?: number;
}

/**
 * Create a large, touch-friendly button (min height 48px enforced).
 * Returns the container so callers can position it.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 360;
  const height = Math.max(48, options.height ?? 84);
  const fillColor = options.fillColor ?? COLORS.yellow;
  const textColor = options.textColor ?? COLORS_HEX.blue;
  const strokeColor = options.strokeColor ?? COLORS.white;

  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const drawBg = (scale = 1) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 18);
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect((-width / 2) * scale, (-height / 2) * scale, width * scale, height * scale, 18);
    bg.lineStyle(4, strokeColor, 1);
    bg.strokeRoundedRect((-width / 2) * scale, (-height / 2) * scale, width * scale, height * scale, 18);
  };
  drawBg();

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: `${options.fontSize ?? 34}px`,
      color: textColor,
      align: 'center',
    })
    .setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(width, height);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );

  container.on('pointerover', () => drawBg(1.03));
  container.on('pointerout', () => drawBg(1));
  container.on('pointerdown', () => {
    drawBg(0.96);
    scene.tweens.add({ targets: container, scale: 0.96, duration: 60, yoyo: true });
  });
  container.on('pointerup', () => {
    drawBg(1);
    audioManager.unlock();
    audioManager.play('click');
    onClick();
  });

  return container;
}

/**
 * Create a bold title with a high-contrast outline.
 */
export function createTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize = 48,
  color: string = COLORS_HEX.yellow,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
    })
    .setOrigin(0.5);
}
