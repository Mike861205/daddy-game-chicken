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
import type { Branch, LeaderboardEntry, LeaderboardPage, PublicConfig } from '../types.js';

const PAGE_SIZE = 50;
const LIST_TOP = 252;
const LIST_BOTTOM = 956;
const ROW_HEIGHT = 72;

/**
 * One personal best per avatar. The first ten places receive premium styling,
 * and every server page contains up to 50 positions.
 */
export class LeaderboardScene extends Phaser.Scene {
  private config!: PublicConfig;
  private branchFilter?: string;
  private currentPage = 1;
  private totalPages = 1;
  private listContainer?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;
  private pageText?: Phaser.GameObjects.Text;
  private scrollOffset = 0;
  private maxScroll = 0;
  private scrollingPointerId: number | null = null;
  private lastPointerY = 0;

  constructor() {
    super(SCENES.Leaderboard);
  }

  create(): void {
    this.config = this.registry.get(REGISTRY.publicConfig) as PublicConfig;
    this.scrollOffset = 0;
    this.scrollingPointerId = null;

    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.blueLight, COLORS.blueLight, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cx = GAME_WIDTH / 2;
    createTitle(this, cx, 92, 'MEJORES PUNTAJES', 40);
    this.add
      .text(cx, 139, `TOP 10 PREMIUM  •  ${PAGE_SIZE} LUGARES POR PÁGINA`, {
        fontFamily: 'Arial Black',
        fontSize: '17px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.createBranchFilter();
    this.createScrollArea();
    this.createPaginationControls();

    this.loadingText = this.add
      .text(cx, 520, 'Cargando…', {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    void this.loadLeaderboard();

    createButton(this, cx, GAME_HEIGHT - 78, 'VOLVER', () => this.scene.start(SCENES.Menu), {
      fillColor: COLORS.red,
      textColor: '#ffffff',
      width: 260,
      height: 60,
      fontSize: 26,
    });
  }

  private createBranchFilter(): void {
    const branches: Branch[] = [{ id: '', name: 'Todas' }, ...(this.config?.branches ?? [])];
    let x = 54;
    const y = 198;
    for (const branch of branches) {
      const isActive = (this.branchFilter ?? '') === branch.id;
      const label = this.add
        .text(x, y, branch.name.replace('Daddy ', ''), {
          fontFamily: 'Arial Black',
          fontSize: '20px',
          color: isActive ? COLORS_HEX.blue : '#ffffff',
          backgroundColor: isActive ? COLORS_HEX.yellow : undefined,
          stroke: '#000000',
          strokeThickness: isActive ? 0 : 3,
          padding: { x: 9, y: 5 },
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      label.on('pointerup', () => {
        this.branchFilter = branch.id || undefined;
        this.currentPage = 1;
        this.scene.restart();
      });
      x += label.width + 18;
    }
  }

  private createScrollArea(): void {
    const zone = this.add
      .zone(
        GAME_WIDTH / 2,
        (LIST_TOP + LIST_BOTTOM) / 2,
        GAME_WIDTH - 48,
        LIST_BOTTOM - LIST_TOP,
      )
      .setDepth(28)
      .setInteractive();

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.scrollingPointerId = pointer.id;
      this.lastPointerY = pointer.y;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && pointer.id === this.scrollingPointerId) {
        const movement = this.lastPointerY - pointer.y;
        this.lastPointerY = pointer.y;
        this.setScrollOffset(this.scrollOffset + movement);
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.scrollingPointerId) {
        this.scrollingPointerId = null;
      }
    });
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => this.setScrollOffset(this.scrollOffset + deltaY * 0.7),
    );
  }

  private createPaginationControls(): void {
    createButton(this, 150, 1018, '‹ ANTERIOR', () => void this.changePage(-1), {
      width: 220,
      height: 58,
      fontSize: 20,
      fillColor: COLORS.blueLight,
      textColor: '#ffffff',
    });
    createButton(this, GAME_WIDTH - 150, 1018, 'SIGUIENTE ›', () => void this.changePage(1), {
      width: 220,
      height: 58,
      fontSize: 20,
      fillColor: COLORS.blueLight,
      textColor: '#ffffff',
    });
    this.pageText = this.add
      .text(GAME_WIDTH / 2, 1018, `PÁGINA ${this.currentPage}`, {
        fontFamily: 'Arial Black',
        fontSize: '19px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const up = this.add
      .text(GAME_WIDTH - 34, LIST_TOP + 24, '▲', {
        fontFamily: 'Arial Black',
        fontSize: '26px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });
    const down = this.add
      .text(GAME_WIDTH - 34, LIST_BOTTOM - 24, '▼', {
        fontFamily: 'Arial Black',
        fontSize: '26px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });
    up.on('pointerdown', () => this.setScrollOffset(this.scrollOffset - ROW_HEIGHT * 4));
    down.on('pointerdown', () => this.setScrollOffset(this.scrollOffset + ROW_HEIGHT * 4));
  }

  private async changePage(direction: -1 | 1): Promise<void> {
    const nextPage = Phaser.Math.Clamp(this.currentPage + direction, 1, this.totalPages);
    if (nextPage === this.currentPage) {
      return;
    }
    this.currentPage = nextPage;
    this.scrollOffset = 0;
    await this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    this.loadingText?.setVisible(true);
    const page = await api.getLeaderboard(this.branchFilter, this.currentPage);
    if (!this.scene.isActive()) {
      return;
    }
    this.loadingText?.destroy();
    this.loadingText = undefined;
    this.totalPages = page.pagination.totalPages;
    this.pageText?.setText(
      `PÁGINA ${page.pagination.page} / ${page.pagination.totalPages}\n${page.pagination.totalEntries} AVATARES`,
    );
    this.renderEntries(page);
  }

  private renderEntries(page: LeaderboardPage): void {
    this.listContainer?.destroy();
    this.listContainer = this.add.container(0, 0).setDepth(20);
    this.scrollOffset = 0;

    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(24, LIST_TOP, GAME_WIDTH - 48, LIST_BOTTOM - LIST_TOP);
    this.listContainer.setMask(maskShape.createGeometryMask());

    if (page.entries.length === 0) {
      const empty = this.add
        .text(GAME_WIDTH / 2, 520, 'Aún no hay puntajes.\n¡Sé el primero!', {
          fontFamily: 'Arial Black',
          fontSize: '28px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
        })
        .setOrigin(0.5);
      this.listContainer.add(empty);
      this.maxScroll = 0;
      return;
    }

    let y = LIST_TOP + ROW_HEIGHT / 2 + 4;
    for (const entry of page.entries) {
      this.renderRow(entry, y);
      y += ROW_HEIGHT;
    }
    this.maxScroll = Math.max(0, page.entries.length * ROW_HEIGHT - (LIST_BOTTOM - LIST_TOP) + 8);
  }

  private renderRow(entry: LeaderboardEntry, y: number): void {
    if (!this.listContainer) {
      return;
    }
    const premium = entry.premium || entry.rank <= 10;
    const row = this.add.graphics();
    row.fillStyle(premium ? COLORS.yellow : COLORS.blue, premium ? 0.95 : 0.55);
    row.fillRoundedRect(32, y - 31, GAME_WIDTH - 64, 62, 13);
    if (premium) {
      row.lineStyle(2, COLORS.white, 0.85);
      row.strokeRoundedRect(32, y - 31, GAME_WIDTH - 64, 62, 13);
    }

    const textColor = premium ? COLORS_HEX.blue : '#ffffff';
    const rankText = this.add
      .text(70, y, premium ? `♛ ${entry.rank}` : `${entry.rank}`, {
        fontFamily: 'Arial Black',
        fontSize: premium ? '21px' : '23px',
        color: textColor,
      })
      .setOrigin(0.5);

    const avatarX = 132;
    const avatarColor = this.colorFromString(entry.nickname);
    const avatarCircle = this.add.graphics();
    avatarCircle.fillStyle(avatarColor, 1);
    avatarCircle.fillCircle(avatarX, y, 23);
    avatarCircle.lineStyle(2, premium ? COLORS.red : COLORS.yellow, 1);
    avatarCircle.strokeCircle(avatarX, y, 23);
    const initial = (entry.nickname.trim()[0] ?? '?').toUpperCase();
    const avatarInitial = this.add
      .text(avatarX, y, initial, {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const nameText = this.add
      .text(170, premium ? y - 8 : y, entry.nickname, {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: textColor,
        wordWrap: { width: 285 },
      })
      .setOrigin(0, 0.5);
    const premiumText = premium
      ? this.add
          .text(170, y + 16, 'PREMIUM', {
            fontFamily: 'Arial Black',
            fontSize: '11px',
            color: COLORS_HEX.red,
          })
          .setOrigin(0, 0.5)
      : undefined;

    const scoreText = this.add
      .text(GAME_WIDTH - 54, y, entry.score.toLocaleString('es-MX'), {
        fontFamily: 'Arial Black',
        fontSize: '25px',
        color: premium ? COLORS_HEX.red : COLORS_HEX.yellow,
      })
      .setOrigin(1, 0.5);

    this.listContainer.add([
      row,
      rankText,
      avatarCircle,
      avatarInitial,
      nameText,
      ...(premiumText ? [premiumText] : []),
      scoreText,
    ]);
  }

  private setScrollOffset(value: number): void {
    this.scrollOffset = Phaser.Math.Clamp(value, 0, this.maxScroll);
    if (this.listContainer) {
      this.listContainer.y = -this.scrollOffset;
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
