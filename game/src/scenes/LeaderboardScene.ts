import Phaser from 'phaser';
import {
  COLORS,
  COLORS_HEX,
  GAME_HEIGHT,
  GAME_WIDTH,
  REGISTRY,
  SCENES,
} from '../config/constants.js';
import { createButton, createTitle } from '../utils/ui.js';
import { api } from '../services/api.js';
import type { Branch, LeaderboardEntry, PublicConfig } from '../types.js';

/**
 * LeaderboardScene: top 10 scores with nickname, score, branch and date.
 */
export class LeaderboardScene extends Phaser.Scene {
  private config!: PublicConfig;
  private branchFilter?: string;
  private listContainer?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.Leaderboard);
  }

  create(): void {
    this.config = this.registry.get(REGISTRY.publicConfig) as PublicConfig;

    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.blueLight, COLORS.blueLight, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cx = GAME_WIDTH / 2;
    createTitle(this, cx, 110, 'MEJORES PUNTAJES', 42);

    this.createBranchFilter();

    this.loadingText = this.add
      .text(cx, 400, 'Cargando…', {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    void this.loadLeaderboard();

    createButton(this, cx, GAME_HEIGHT - 120, 'VOLVER', () => this.scene.start(SCENES.Menu), {
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
  }

  private createBranchFilter(): void {
    const branches: Branch[] = [{ id: '', name: 'Todas' }, ...(this.config?.branches ?? [])];
    let x = 60;
    const y = 190;
    for (const branch of branches) {
      const isActive = (this.branchFilter ?? '') === branch.id;
      const label = this.add
        .text(x, y, branch.name.replace('Daddy ', ''), {
          fontFamily: 'Arial Black',
          fontSize: '22px',
          color: isActive ? COLORS_HEX.blue : '#ffffff',
          backgroundColor: isActive ? COLORS_HEX.yellow : undefined,
          stroke: '#000000',
          strokeThickness: isActive ? 0 : 3,
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      label.on('pointerup', () => {
        this.branchFilter = branch.id || undefined;
        this.scene.restart();
      });
      x += label.width + 24;
    }
  }

  private async loadLeaderboard(): Promise<void> {
    const entries = await api.getLeaderboard(this.branchFilter);
    this.loadingText?.destroy();
    this.renderEntries(entries);
  }

  private renderEntries(entries: LeaderboardEntry[]): void {
    this.listContainer?.destroy();
    this.listContainer = this.add.container(0, 0);

    if (entries.length === 0) {
      const empty = this.add
        .text(GAME_WIDTH / 2, 420, 'Aún no hay puntajes.\n¡Sé el primero!', {
          fontFamily: 'Arial Black',
          fontSize: '28px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
        })
        .setOrigin(0.5);
      this.listContainer.add(empty);
      return;
    }

    let y = 280;
    for (const entry of entries) {
      const highlight = entry.rank <= 3;
      const rowH = 84;
      const row = this.add.graphics();
      row.fillStyle(highlight ? COLORS.yellow : COLORS.blue, highlight ? 0.92 : 0.55);
      row.fillRoundedRect(40, y - rowH / 2, GAME_WIDTH - 80, rowH, 16);
      this.listContainer.add(row);

      const textColor = highlight ? COLORS_HEX.blue : '#ffffff';

      // Rank badge.
      const rankText = this.add
        .text(78, y, `${entry.rank}`, {
          fontFamily: 'Arial Black',
          fontSize: '30px',
          color: textColor,
        })
        .setOrigin(0.5);

      // Circular avatar with the player's initial.
      const avatarX = 160;
      const avatarColor = this.colorFromString(entry.nickname);
      const avatarCircle = this.add.graphics();
      avatarCircle.fillStyle(avatarColor, 1);
      avatarCircle.fillCircle(avatarX, y, 32);
      avatarCircle.lineStyle(3, highlight ? COLORS.red : COLORS.yellow, 1);
      avatarCircle.strokeCircle(avatarX, y, 32);
      const initial = (entry.nickname.trim()[0] ?? '?').toUpperCase();
      const avatarInitial = this.add
        .text(avatarX, y, initial, {
          fontFamily: 'Arial Black',
          fontSize: '32px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      // Avatar name (main label).
      const nameText = this.add
        .text(212, y, entry.nickname, {
          fontFamily: 'Arial Black',
          fontSize: '30px',
          color: textColor,
          wordWrap: { width: GAME_WIDTH - 380 },
        })
        .setOrigin(0, 0.5);

      // Score.
      const scoreText = this.add
        .text(GAME_WIDTH - 70, y, `${entry.score}`, {
          fontFamily: 'Arial Black',
          fontSize: '32px',
          color: highlight ? COLORS_HEX.red : COLORS_HEX.yellow,
        })
        .setOrigin(1, 0.5);

      this.listContainer.add([
        rankText,
        avatarCircle,
        avatarInitial,
        nameText,
        scoreText,
      ]);
      y += rowH + 12;
    }
  }

  /** Derive a stable, vivid color from a string (for avatar circles). */
  private colorFromString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    const color = Phaser.Display.Color.HSVToRGB(hue / 360, 0.65, 0.85);
    return (color as Phaser.Types.Display.ColorObject).color ?? COLORS.blue;
  }
}
