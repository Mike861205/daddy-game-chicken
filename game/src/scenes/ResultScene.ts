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
import { resolvePromotion } from '../utils/promotion.js';
import { api, DEFAULT_CONFIG } from '../services/api.js';
import { storage } from '../services/storage.js';
import { removeRegistrationOverlays } from '../services/registrationForm.js';
import type { GameResult, PublicConfig, RewardResponse } from '../types.js';
import { buildWhatsAppUrl } from '../utils/whatsapp.js';

/**
 * ResultScene: shows the final score, personal best, promotion, and actions.
 */
export class ResultScene extends Phaser.Scene {
  private result!: GameResult;
  private config!: PublicConfig;
  private nicknameInput?: Phaser.GameObjects.DOMElement;
  private saved = false;
  private saving = false;
  private statusText!: Phaser.GameObjects.Text;
  private reward: RewardResponse | null = null;

  constructor() {
    super(SCENES.Result);
  }

  create(): void {
    removeRegistrationOverlays();
    this.result = this.registry.get(REGISTRY.lastResult) as GameResult;
    this.config =
      (this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined) ?? DEFAULT_CONFIG;
    this.saved = false;
    this.saving = false;
    this.reward = null;
    this.nicknameInput = undefined;
    this.input.enabled = true;
    this.cameras.main.resetFX();
    this.scale.refresh();

    if (!this.result) {
      this.scene.start(SCENES.Menu);
      return;
    }

    this.drawBackground();
    storage.setBestScore(this.result.score);
    const best = storage.getBestScore();

    const cx = GAME_WIDTH / 2;
    createTitle(this, cx, 120, '¡FIN DEL JUEGO!', 46);

    // Score.
    this.add
      .text(cx, 230, `${this.result.score}`, {
        fontFamily: 'Arial Black',
        fontSize: '110px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 310, 'PUNTOS', {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Best score.
    this.add
      .text(cx, 370, `Tu récord: ${best}`, {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: COLORS_HEX.neon,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Promotion.
    const promo = resolvePromotion(this.result.score, this.config.promotions);
    this.add
      .text(cx, 410, promo.levelName.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: COLORS_HEX.neon,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 455, promo.label, {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: COLORS_HEX.red,
        stroke: '#ffffff',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    // Avatar input (DOM element).
    this.add
      .text(cx, 500, 'Tu avatar:', {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.createNicknameInput(cx, 560);

    // Status text for save feedback.
    this.statusText = this.add
      .text(cx, 620, '', {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: COLORS_HEX.neon,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    // Buttons.
    createButton(this, cx, 720, 'REINTENTAR GUARDADO', () => void this.saveScore(), {
      fillColor: COLORS.green,
      textColor: '#ffffff',
      width: 420,
    });
    createButton(this, cx, 820, 'JUGAR OTRA VEZ', () => this.scene.start(SCENES.Game), {
      width: 420,
    });
    createButton(this, cx - 110, 930, 'ENVIAR PREMIO', () => this.shareWhatsApp(), {
      width: 200,
      fillColor: COLORS.green,
      textColor: '#ffffff',
      fontSize: 20,
    });
    createButton(this, cx + 110, 930, 'PROMOCIÓN', () => this.showPromotion(promo.label), {
      width: 200,
      fillColor: COLORS.red,
      textColor: '#ffffff',
      fontSize: 24,
    });
    createButton(this, cx, 1030, 'MENÚ', () => this.scene.start(SCENES.Menu), {
      width: 260,
      height: 60,
      fontSize: 26,
    });

    // The avatar is known before the match starts, so saving no longer
    // depends on the player pressing a button at the end.
    this.statusText.setColor(COLORS_HEX.white);
    this.statusText.setText('Guardando tu puntaje automáticamente…');
    this.time.delayedCall(150, () => void this.saveScore());
  }

  private createNicknameInput(x: number, y: number): void {
    const existing =
      (this.registry.get(REGISTRY.nickname) as string | undefined) ?? storage.getNickname();
    const html = `<input type="text" maxlength="20" placeholder="Tu avatar" value="${this.escapeHtml(existing)}"
      style="width:380px;height:52px;font-size:26px;text-align:center;border-radius:12px;
      border:3px solid ${COLORS_HEX.yellow};font-family:'Arial Black',sans-serif;
      color:${COLORS_HEX.blue};outline:none;" />`;
    this.nicknameInput = this.add.dom(x, y).createFromHTML(html);
  }

  private getNickname(): string {
    const el = (this.nicknameInput?.node as HTMLElement | undefined)?.querySelector('input');
    const value = (el?.value ?? '').trim();
    return value || 'Jugador';
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/gu, (c) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[c];
    });
  }

  private async saveScore(): Promise<void> {
    if (this.saved) {
      this.statusText.setText('Ya guardaste esta partida.');
      return;
    }
    if (this.saving) {
      return;
    }
    this.saving = true;
    const nickname = this.getNickname();
    storage.setNickname(nickname);
    this.registry.set(REGISTRY.nickname, nickname);
    const phone = (this.registry.get(REGISTRY.playerPhone) as string | undefined) ?? undefined;
    const name = (this.registry.get(REGISTRY.playerName) as string | undefined) ?? undefined;
    this.statusText.setColor(COLORS_HEX.white);
    this.statusText.setText('Guardando automáticamente…');

    try {
      const response = await api.submitGameSession(this.result, nickname, phone, name);
      if (!this.scene.isActive()) {
        return;
      }
      this.saved = true;
      this.statusText.setColor(COLORS_HEX.neon);
      this.statusText.setText(
        response.isPersonalBest
          ? `¡Nuevo récord guardado! Posición aprox: #${response.approximatePosition}`
          : `Partida registrada. Tu récord sigue en ${response.bestScore.toLocaleString('es-MX')}.`,
      );

      // Request a reward if the score qualifies.
      this.reward = await api.requestReward(this.result.clientSessionId);
      if (!this.scene.isActive()) {
        return;
      }
      if (this.reward?.granted && this.reward.code) {
        this.time.delayedCall(400, () =>
          this.showPromotion(this.reward?.label ?? '', this.reward?.code),
        );
      }
    } catch (error) {
      if (!this.scene.isActive()) {
        return;
      }
      this.statusText.setColor(COLORS_HEX.red);
      this.statusText.setText(
        error instanceof Error ? error.message : 'No se pudo guardar. Intenta de nuevo.',
      );
    } finally {
      this.saving = false;
    }
  }

  private shareWhatsApp(): void {
    if (!this.saved) {
      this.statusText.setColor(COLORS_HEX.yellow);
      this.statusText.setText('Primero guarda tu puntaje para generar el premio.');
      return;
    }

    const configuredPhone = this.config?.contact.businessPhone ?? '6241548148';
    const playerName = (this.registry.get(REGISTRY.playerName) as string | undefined) ?? this.getNickname();
    const playerPhone = (this.registry.get(REGISTRY.playerPhone) as string | undefined) ?? 'No registrado';
    const promotion = resolvePromotion(this.result.score, this.config.promotions);
    const prizeLabel = this.reward?.label ?? promotion.label;
    const rewardCode = this.reward?.code ?? 'Sin código';
    const message = [
      'Hola Daddy Pollo 👋',
      `Soy ${playerName}.`,
      `Mi teléfono registrado es ${playerPhone}.`,
      `Obtuve ${this.result.score} puntos en Daddy Game Chicken.`,
      `Nivel alcanzado: ${promotion.levelName}.`,
      `Premio: ${prizeLabel}.`,
      `Código de canje: ${rewardCode}.`,
      'Quiero solicitar el canje de mi premio.',
    ].join('\n');
    window.open(buildWhatsAppUrl(configuredPhone, message), '_blank', 'noopener');
  }

  private showPromotion(label: string, code?: string): void {
    const overlay = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setOrigin(0)
      .setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.blue, 1);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 320, 420, 640, 440, 24);
    panel.lineStyle(5, COLORS.yellow, 1);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 320, 420, 640, 440, 24);

    const title = createTitle(this, GAME_WIDTH / 2, 500, 'TU PROMOCIÓN', 36);
    const labelText = this.add
      .text(GAME_WIDTH / 2, 590, label, {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);

    overlay.add([shade, panel, title, labelText]);

    if (code) {
      const codeText = this.add
        .text(GAME_WIDTH / 2, 680, `Código: ${code}`, {
          fontFamily: 'Arial Black',
          fontSize: '34px',
          color: COLORS_HEX.neon,
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5);
      const hint = this.add
        .text(GAME_WIDTH / 2, 730, 'Muestra este código en sucursal', {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      overlay.add([codeText, hint]);
    } else {
      const hint = this.add
        .text(GAME_WIDTH / 2, 690, 'Guarda tu puntaje para obtener tu código', {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 560 },
        })
        .setOrigin(0.5);
      overlay.add(hint);
    }

    const close = createButton(this, GAME_WIDTH / 2, 810, 'CERRAR', () => overlay.destroy(), {
      width: 240,
      height: 60,
      fontSize: 26,
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
    overlay.add(close);
    shade.on('pointerup', () => overlay.destroy());
  }

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.blueLight, COLORS.blueLight, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
