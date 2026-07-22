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
  glowColor?: number;
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
  const glowColor = options.glowColor ?? fillColor;
  const glowHex = `#${glowColor.toString(16).padStart(6, '0')}`;

  const container = scene.add.container(x, y);

  const glow = scene.add.graphics();
  const bg = scene.add.graphics();
  const shine = scene.add.graphics();

  type ButtonState = 'normal' | 'hover' | 'pressed';
  const drawBg = (state: ButtonState = 'normal') => {
    const isHover = state === 'hover';
    const isPressed = state === 'pressed';
    const inset = isPressed ? 3 : 0;

    glow.clear();
    bg.clear();
    shine.clear();

    // Multiple translucent layers give the button a neon glow without
    // changing its real hit area.
    glow.fillStyle(glowColor, isHover ? 0.24 : 0.11);
    glow.fillRoundedRect(-width / 2 - 12, -height / 2 - 12, width + 24, height + 24, 26);
    glow.lineStyle(isHover ? 9 : 6, glowColor, isHover ? 0.28 : 0.13);
    glow.strokeRoundedRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, 23);

    bg.fillStyle(0x020817, 0.55);
    bg.fillRoundedRect(-width / 2 + 5, -height / 2 + 8, width, height, 21);
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, 20);
    bg.lineStyle(isHover ? 5 : 3, strokeColor, 1);
    bg.strokeRoundedRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, 20);

    // Gloss, lower shade and a small energy marker make the buttons feel
    // dimensional while keeping the label highly legible.
    shine.fillStyle(0xffffff, isHover ? 0.24 : 0.15);
    shine.fillRoundedRect(-width / 2 + 8, -height / 2 + 7, width - 16, Math.max(12, height * 0.3), 13);
    shine.fillStyle(0x000000, 0.12);
    shine.fillRoundedRect(-width / 2 + 8, height / 2 - 15, width - 16, 8, 5);
    shine.fillStyle(strokeColor, isHover ? 1 : 0.75);
    shine.fillTriangle(-width / 2 + 19, 0, -width / 2 + 28, -9, -width / 2 + 28, 9);
  };
  drawBg();

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
      fontSize: `${options.fontSize ?? 34}px`,
      color: textColor,
      stroke: '#06143a',
      strokeThickness: textColor === '#ffffff' ? 3 : 1,
      align: 'center',
      letterSpacing: 1.4,
    })
    .setOrigin(0.5)
    .setShadow(0, 0, glowHex, 9, true, true);

  // A Zone has a native rectangular input area. Using it avoids the shifted
  // custom Container hit rectangle that made only the button centre respond.
  const padX = 14;
  const padY = 5;
  const hitZone = scene.add
    .zone(0, 0, width + padX * 2, height + padY * 2)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  container.add([glow, bg, shine, text, hitZone]);
  container.setSize(width, height);

  const animateScale = (scale: number, duration: number) => {
    scene.tweens.killTweensOf(container);
    scene.tweens.add({ targets: container, scale, duration, ease: 'Quad.out' });
  };

  hitZone.on('pointerover', () => {
    drawBg('hover');
    animateScale(1.025, 110);
  });
  hitZone.on('pointerout', () => {
    drawBg('normal');
    animateScale(1, 120);
  });
  hitZone.on('pointerdown', () => {
    drawBg('pressed');
    animateScale(0.975, 55);
  });
  hitZone.on('pointerup', () => {
    drawBg('hover');
    animateScale(1.025, 80);
    audioManager.unlock();
    audioManager.play('click');
    onClick();
  });

  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.7, to: 1 },
    duration: 950,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
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
      fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
      fontSize: `${fontSize}px`,
      color,
      stroke: '#07153e',
      strokeThickness: 7,
      align: 'center',
      letterSpacing: 2,
    })
    .setOrigin(0.5)
    .setShadow(0, 0, color, 12, true, true);
}
