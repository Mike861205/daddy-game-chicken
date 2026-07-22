import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, REGISTRY, SCENES } from '../config/constants.js';
import { createButton, createTitle } from '../utils/ui.js';
import { audioManager } from '../services/audio.js';
import { storage } from '../services/storage.js';
import type { PublicConfig } from '../types.js';

/**
 * MenuScene: logo, main buttons, sound toggle and branch selection overlay.
 */
export class MenuScene extends Phaser.Scene {
  private soundButton?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.Menu);
  }

  create(): void {
    this.drawBackground();

    // Unlock audio on the first interaction with the menu.
    this.input.once('pointerdown', () => audioManager.unlock());

    const cx = GAME_WIDTH / 2;

    // Logo.
    const logo = this.add.image(cx, 260, 'logo-daddy-game-chicken').setOrigin(0.5);
    const maxLogoWidth = GAME_WIDTH * 0.82;
    if (logo.width > maxLogoWidth) {
      logo.setScale(maxLogoWidth / logo.width);
    }
    this.tweens.add({ targets: logo, y: 275, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    createTitle(this, cx, 430, 'ATRAPA EL SABOR', 34, '#ffffff');

    // Main buttons.
    createButton(this, cx, 600, 'JUGAR', () => this.openBranchSelection(), {
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
    createButton(this, cx, 710, 'CÓMO JUGAR', () => this.scene.start(SCENES.Instructions));
    createButton(this, cx, 820, 'MEJORES PUNTAJES', () => this.scene.start(SCENES.Leaderboard));

    // Sound toggle.
    this.createSoundToggle(cx, 940);

    // Business contact footer.
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const phone = config?.contact.businessPhone ?? '6241548148';
    this.add
      .text(cx, GAME_HEIGHT - 60, `Daddy Pollo · Tel: ${phone}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }

  private createSoundToggle(x: number, y: number): void {
    const label = () => (audioManager.isEnabled() ? '🔊 SONIDO: SÍ' : '🔇 SONIDO: NO');
    this.soundButton = this.add
      .text(x, y, label(), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '26px',
        color: '#ffd21e',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.soundButton.on('pointerup', () => {
      audioManager.unlock();
      const enabled = audioManager.toggle();
      this.registry.set(REGISTRY.soundEnabled, enabled);
      this.soundButton?.setText(label());
      if (enabled) {
        audioManager.play('click');
      }
    });
  }

  private openBranchSelection(): void {
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const branches = config?.branches ?? [];

    const overlay = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    overlay.add(shade);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.blue, 1);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 320, 360, 640, 560, 24);
    panel.lineStyle(5, COLORS.yellow, 1);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 320, 360, 640, 560, 24);
    overlay.add(panel);

    overlay.add(createTitle(this, GAME_WIDTH / 2, 430, 'ELIGE TU SUCURSAL', 34));

    let y = 540;
    for (const branch of branches) {
      const btn = createButton(
        this,
        GAME_WIDTH / 2,
        y,
        branch.name,
        () => {
          this.registry.set(REGISTRY.selectedBranch, branch.id);
          storage.setBranch(branch.id);
          overlay.destroy();
          this.scene.start(SCENES.Game);
        },
        { width: 520, height: 80, fontSize: 28 },
      );
      overlay.add(btn);
      y += 110;
    }

    const cancel = createButton(this, GAME_WIDTH / 2, y + 10, 'CANCELAR', () => overlay.destroy(), {
      width: 260,
      height: 60,
      fontSize: 24,
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
    overlay.add(cancel);
  }

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.blueLight, COLORS.blueLight, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (this.textures.exists('fondo-los-cabos')) {
      this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'fondo-los-cabos')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.35);
    }
  }
}
