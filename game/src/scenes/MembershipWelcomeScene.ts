import Phaser from 'phaser';
import {
  MEMBERSHIP_PLANS,
  hasActiveMembership,
  type MembershipEntitlement,
  type MembershipPlanId,
} from '../config/memberships.js';
import {
  COLORS,
  COLORS_HEX,
  GAME_HEIGHT,
  GAME_WIDTH,
  REGISTRY,
  SCENES,
} from '../config/constants.js';
import { api } from '../services/api.js';
import { audioManager } from '../services/audio.js';
import { storage } from '../services/storage.js';

interface WelcomeData {
  planId?: MembershipPlanId;
  sessionId?: string;
}

/**
 * Post-payment cinematic. The celebration is immediate, while actual premium
 * access is only persisted after Stripe or the webhook confirms the payment.
 */
export class MembershipWelcomeScene extends Phaser.Scene {
  private planId: MembershipPlanId = 'daddy-plus';
  private sessionId = '';
  private statusText?: Phaser.GameObjects.Text;
  private actionText?: Phaser.GameObjects.Text;
  private actionButton?: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENES.MembershipWelcome);
  }

  init(data: WelcomeData): void {
    const storedPlan = sessionStorage.getItem('dgc.pendingMembershipPlan');
    this.planId = data.planId
      ?? (storedPlan === 'daddy-elite' ? 'daddy-elite' : 'daddy-plus');
    this.sessionId = data.sessionId ?? '';
  }

  create(): void {
    const plan = MEMBERSHIP_PLANS[this.planId];
    const accent = plan.id === 'daddy-elite' ? COLORS.yellow : COLORS.neon;
    const accentHex = plan.id === 'daddy-elite' ? COLORS_HEX.yellow : COLORS_HEX.neon;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x061a43, 0x123f9c, 0x020817, 0x07152e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const rays = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    rays.fillStyle(accent, 0.07);
    for (let index = 0; index < 9; index += 1) {
      const center = GAME_WIDTH / 2;
      const angleA = -Math.PI + index * 0.34;
      const angleB = angleA + 0.16;
      rays.fillTriangle(
        center,
        390,
        center + Math.cos(angleA) * 850,
        390 + Math.sin(angleA) * 850,
        center + Math.cos(angleB) * 850,
        390 + Math.sin(angleB) * 850,
      );
    }

    const halo = this.add
      .circle(GAME_WIDTH / 2, 410, 235, accent, 0.13)
      .setStrokeStyle(5, accent, 0.28)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      scale: { from: 0.82, to: 1.16 },
      alpha: { from: 0.08, to: 0.24 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 54, 'JUEGA CON MEMBRESÍA', {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '31px',
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 7,
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    const welcome = this.add
      .text(GAME_WIDTH / 2, 115, '¡BIENVENIDO AL EQUIPO!', {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '46px',
        color: accentHex,
        stroke: '#020817',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.65);
    const planName = this.add
      .text(GAME_WIDTH / 2, 178, plan.name, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '25px',
        color: '#ffffff',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const daddy = this.add
      .image(
        GAME_WIDTH / 2,
        420,
        plan.id === 'daddy-elite' ? 'skin-rey-sabor' : 'skin-comandante-neon',
      )
      .setDisplaySize(390, 390)
      .setAlpha(0)
      .setScale(0.3)
      .setAngle(-9);
    this.tweens.add({
      targets: welcome,
      alpha: 1,
      scale: 1,
      duration: 680,
      ease: 'Back.out',
    });
    this.tweens.add({
      targets: planName,
      alpha: 1,
      y: 188,
      duration: 560,
      delay: 420,
      ease: 'Quad.out',
    });
    this.tweens.add({
      targets: daddy,
      alpha: 1,
      scale: 1,
      angle: 0,
      duration: 900,
      delay: 240,
      ease: 'Back.out',
      onComplete: () => audioManager.play('power'),
    });
    this.tweens.add({
      targets: daddy,
      y: { from: 420, to: 402 },
      duration: 1050,
      delay: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const confetti = this.add.particles(0, -30, '__WHITE', {
      x: { min: 20, max: GAME_WIDTH - 20 },
      speedY: { min: 190, max: 410 },
      speedX: { min: -85, max: 85 },
      rotate: { min: 0, max: 540 },
      lifespan: { min: 2100, max: 4000 },
      scaleX: { start: 0.55, end: 0.18 },
      scaleY: { start: 0.22, end: 0.08 },
      tint: [COLORS.yellow, COLORS.red, COLORS.neon, COLORS.white, plan.color],
      frequency: 38,
      quantity: 2,
      gravityY: 70,
    }).setDepth(20);
    this.time.delayedCall(3900, () => confetti.stop());

    const panel = this.add.container(GAME_WIDTH / 2, 880).setAlpha(0).setScale(0.92);
    const panelGlow = this.add
      .rectangle(0, 0, 642, 500, accent, 0.11)
      .setStrokeStyle(6, accent, 0.22);
    const panelBg = this.add
      .rectangle(0, 0, 624, 482, 0x06142e, 0.985)
      .setStrokeStyle(3, accent, 0.94);
    const unlocked = this.add
      .text(0, -205, 'TUS BENEFICIOS', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '22px',
        color: accentHex,
      })
      .setOrigin(0.5);
    const benefitTexts = plan.benefits.map((benefit, index) =>
      this.add
        .text(-270, -154 + index * 61, `✓  ${benefit}`, {
          fontFamily: 'Trebuchet MS, Arial, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
          wordWrap: { width: 540, useAdvancedWrap: true },
        })
        .setOrigin(0, 0.5),
    );
    this.statusText = this.add
      .text(0, 114, 'CONFIRMANDO TU PAGO SEGURO...', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '14px',
        color: '#b9c9e8',
        align: 'center',
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5);
    this.actionButton = this.add
      .rectangle(0, 184, 520, 68, plan.color, 1)
      .setStrokeStyle(3, COLORS.white, 0.9)
      .setInteractive({ useHandCursor: true });
    this.actionText = this.add
      .text(0, 184, 'VER MIS BENEFICIOS', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    panel.add([
      panelGlow,
      panelBg,
      unlocked,
      ...benefitTexts,
      this.statusText,
      this.actionButton,
      this.actionText,
    ]);
    this.actionButton.on('pointerover', () => panel.setScale(1.015));
    this.actionButton.on('pointerout', () => panel.setScale(1));
    this.actionButton.on('pointerup', () => {
      audioManager.play('click');
      this.scene.start(SCENES.Membership);
    });
    this.tweens.add({
      targets: panel,
      alpha: 1,
      scale: 1,
      y: 858,
      duration: 620,
      delay: 1150,
      ease: 'Back.out',
    });

    window.history.replaceState({}, '', window.location.pathname);
    void this.confirmAccess();
  }

  private async confirmAccess(): Promise<void> {
    const phone = storage.getPlayerPhone();
    let membership: MembershipEntitlement | null = null;
    if (this.sessionId && phone) {
      try {
        membership = await api.confirmMembershipCheckout(this.sessionId, phone);
      } catch {
        membership = null;
      }
    }
    if (!hasActiveMembership(membership) && phone) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await new Promise<void>((resolve) => {
          this.time.delayedCall(1500, resolve);
        });
        membership = await api.getMembershipStatus(phone);
        if (hasActiveMembership(membership)) break;
      }
    }

    if (!this.scene.isActive()) return;
    if (hasActiveMembership(membership)) {
      membership.selectedOutfit = storage.getSelectedOutfit();
      membership.selectedWeapon = storage.getSelectedWeapon();
      storage.setMembership(membership);
      this.registry.set(REGISTRY.membership, membership);
      this.statusText
        ?.setText('✓ BENEFICIOS DESBLOQUEADOS EN ESTE TELÉFONO')
        .setColor(COLORS_HEX.neon);
      this.actionText?.setText('ENTRAR A MI MEMBRESÍA');
      sessionStorage.removeItem('dgc.pendingMembershipPlan');
      sessionStorage.removeItem('dgc.pendingMembershipProduct');
    } else {
      this.statusText
        ?.setText('PAGO RECIBIDO • ACTIVACIÓN EN PROCESO')
        .setColor(COLORS_HEX.yellow);
      this.actionText?.setText('REVISAR MI MEMBRESÍA');
    }
  }
}
