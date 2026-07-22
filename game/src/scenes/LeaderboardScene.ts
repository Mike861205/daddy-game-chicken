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

  private branchName(id: string): string {
    const branch = this.config?.branches.find((b: Branch) => b.id === id);
    return branch?.name ?? id;
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

    let y = 270;
    for (const entry of entries) {
      const row = this.add.graphics();
      const highlight = entry.rank <= 3;
      row.fillStyle(highlight ? COLORS.yellow : COLORS.blue, highlight ? 0.9 : 0.6);
      row.fillRoundedRect(40, y - 32, GAME_WIDTH - 80, 64, 12);
      this.listContainer.add(row);

      const textColor = highlight ? COLORS_HEX.blue : '#ffffff';
      const date = new Date(entry.createdAt);
      const dateStr = Number.isNaN(date.getTime())
        ? ''
        : `${date.getDate()}/${date.getMonth() + 1}`;

      const rankText = this.add
        .text(70, y, `${entry.rank}`, {
          fontFamily: 'Arial Black',
          fontSize: '30px',
          color: textColor,
        })
        .setOrigin(0, 0.5);
      const nameText = this.add
        .text(130, y - 10, entry.nickname, {
          fontFamily: 'Arial Black',
          fontSize: '26px',
          color: textColor,
        })
        .setOrigin(0, 0.5);
      const branchText = this.add
        .text(130, y + 14, `${this.branchName(entry.selectedBranch)} · ${dateStr}`, {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: highlight ? '#1a3a7a' : '#cfe0ff',
        })
        .setOrigin(0, 0.5);
      const scoreText = this.add
        .text(GAME_WIDTH - 70, y, `${entry.score}`, {
          fontFamily: 'Arial Black',
          fontSize: '30px',
          color: highlight ? COLORS_HEX.red : COLORS_HEX.yellow,
        })
        .setOrigin(1, 0.5);

      this.listContainer.add([rankText, nameText, branchText, scoreText]);
      y += 76;
    }
  }
}
