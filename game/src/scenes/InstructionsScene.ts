import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants.js';
import { createButton, createTitle } from '../utils/ui.js';

/**
 * InstructionsScene: short, icon-supported instructions.
 */
export class InstructionsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Instructions);
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.blueLight, COLORS.blueLight, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cx = GAME_WIDTH / 2;
    createTitle(this, cx, 120, 'CÓMO JUGAR', 48);

    // Brief description of the game.
    this.add
      .text(
        cx,
        220,
        'Controla a Daddy Pollo y atrapa los platillos que caen.\n' +
          'Suma puntos con cada producto, haz combos y usa poderes.\n' +
          'Evita lo quemado: ¡pierdes vidas! Tienes 60 segundos.',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          color: '#eaf1ff',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          lineSpacing: 8,
          wordWrap: { width: GAME_WIDTH - 80 },
        },
      )
      .setOrigin(0.5);

    const steps: { icon: string; text: string }[] = [
      { icon: '👈👉', text: 'MUEVE AL DADDY' },
      { icon: '🍗', text: 'ATRAPA LOS PLATILLOS' },
      { icon: '🔥', text: 'ESQUIVA LO QUEMADO' },
      { icon: '🏆', text: 'CONSIGUE EL MAYOR PUNTAJE' },
    ];

    let y = 380;
    for (const step of steps) {
      const card = this.add.graphics();
      card.fillStyle(COLORS.blue, 0.85);
      card.fillRoundedRect(cx - 300, y - 55, 600, 110, 18);
      card.lineStyle(3, COLORS.yellow, 1);
      card.strokeRoundedRect(cx - 300, y - 55, 600, 110, 18);

      this.add
        .text(cx - 230, y, step.icon, { fontSize: '48px' })
        .setOrigin(0.5);
      this.add
        .text(cx - 150, y, step.text, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '30px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'left',
          wordWrap: { width: 420 },
        })
        .setOrigin(0, 0.5);
      y += 150;
    }

    // Extra tips.
    this.add
      .text(cx, y + 20, 'Poderes: escudo, doble puntos, y más', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#21e6c1',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5);

    createButton(this, cx, GAME_HEIGHT - 130, 'VOLVER', () => this.scene.start(SCENES.Menu), {
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
  }
}
