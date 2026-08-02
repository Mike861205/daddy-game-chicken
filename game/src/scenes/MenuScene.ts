import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, REGISTRY, SCENES } from '../config/constants.js';
import { createButton, createTitle } from '../utils/ui.js';
import { audioManager } from '../services/audio.js';
import { storage } from '../services/storage.js';
import {
  removeRegistrationOverlays,
  showRegistrationForm,
  showReturningPlayerForm,
} from '../services/registrationForm.js';
import type { RegistrationData } from '../services/registrationForm.js';
import { api } from '../services/api.js';
import type { PublicConfig } from '../types.js';
import { buildWhatsAppUrl } from '../utils/whatsapp.js';
import { pwaManager } from '../services/pwa.js';
import {
  MEMBERSHIP_PLANS,
  hasActiveMembership,
  withLocalDevelopmentAccess,
  type MembershipEntitlement,
} from '../config/memberships.js';

const FOOD_ORDER_MESSAGE = 'Quiero pedir de comer a Daddy Pollo, ¿me regalas el menú?';

/**
 * MenuScene: logo, main buttons, sound toggle and player registration.
 */
export class MenuScene extends Phaser.Scene {
  private soundButton?: Phaser.GameObjects.Text;
  private formOpen = false;
  private transitioning = false;
  private memberSessionPromise?: Promise<void>;
  private rememberedPlayer?: {
    name: string | null;
    avatar: string;
    phone: string | null;
  };
  private activeMembership?: MembershipEntitlement;
  private memberBadge?: Phaser.GameObjects.Container;
  private rewardButton?: Phaser.GameObjects.Container;
  private rewardClaiming = false;

  constructor() {
    super(SCENES.Menu);
  }

  create(): void {
    this.formOpen = false;
    this.transitioning = false;
    this.rewardClaiming = false;
    this.rememberedPlayer = undefined;
    this.activeMembership = undefined;
    this.input.enabled = true;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
      this.input.keyboard.disableGlobalCapture();
    }
    this.cameras.main.resetFX();
    removeRegistrationOverlays();
    this.scale.refresh();
    this.drawBackground();

    // Unlock audio on the first interaction with the menu.
    this.input.once('pointerdown', () => audioManager.unlock());

    const cx = GAME_WIDTH / 2;

    // Logo with a soft energy halo.
    const logoHalo = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    logoHalo.fillStyle(COLORS.neon, 0.08);
    logoHalo.fillRoundedRect(cx - 305, 126, 610, 246, 42);
    logoHalo.lineStyle(5, COLORS.neon, 0.18);
    logoHalo.strokeRoundedRect(cx - 295, 136, 590, 226, 36);
    this.tweens.add({
      targets: logoHalo,
      alpha: { from: 0.55, to: 1 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const logo = this.add.image(cx, 245, 'logo-daddy-game-chicken').setOrigin(0.5);
    const maxLogoWidth = GAME_WIDTH * 0.82;
    if (logo.width > maxLogoWidth) {
      logo.setScale(maxLogoWidth / logo.width);
    }
    this.tweens.add({ targets: logo, y: 258, duration: 1450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.memberBadge = this.add.container(cx, 82).setDepth(30).setVisible(false);

    const kicker = this.add
      .text(cx, 412, '⚡  MENÚ PRINCIPAL  ⚡', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#21e6c1',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#21e6c1', 12, true, true);
    this.tweens.add({ targets: kicker, alpha: { from: 0.65, to: 1 }, duration: 850, yoyo: true, repeat: -1 });
    createTitle(this, cx, 458, 'ATRAPA EL SABOR', 38, '#ffffff');

    // Main buttons.
    createButton(this, cx, 530, 'JUGAR', () => void this.playPrimary(), {
      width: 500,
      height: 68,
      fontSize: 31,
      fillColor: COLORS.red,
      textColor: '#ffffff',
      glowColor: 0xff2748,
    });
    createButton(this, cx, 612, '¿YA JUGASTE ANTES?', () => void this.openReturning(), {
      width: 500,
      height: 66,
      fontSize: 25,
      fillColor: COLORS.green,
      textColor: '#ffffff',
      glowColor: 0x39ff6e,
    });
    createButton(this, cx, 694, 'JUEGA CON MEMBRESÍA', () => this.scene.start(SCENES.Membership), {
      width: 500,
      height: 66,
      fontSize: 25,
      fillColor: 0x8c35d8,
      textColor: '#ffffff',
      glowColor: COLORS.yellow,
    });
    createButton(this, cx, 776, 'CÓMO JUGAR', () => this.scene.start(SCENES.Instructions), {
      width: 500,
      height: 66,
      fontSize: 26,
      glowColor: COLORS.yellow,
    });
    createButton(this, cx, 858, 'MEJORES PUNTAJES', () => this.scene.start(SCENES.Leaderboard), {
      width: 500,
      height: 66,
      fontSize: 25,
      glowColor: 0x43d9ff,
    });
    createButton(this, cx, 940, 'DESCARGA LA APP', () => this.openInstallModule(), {
      width: 500,
      height: 66,
      fontSize: 24,
      fillColor: 0x6f46d9,
      textColor: '#ffffff',
      glowColor: 0xb66cff,
    });

    // Sound toggle.
    this.createSoundToggle(cx, 1022);

    const arsenalBadge = this.add
      .text(cx, 1093, '⚔ NUEVO COMBATE: CORRE • DISPARA • CÚBRETE', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#21e6c1', 8, true, true);
    this.tweens.add({
      targets: arsenalBadge,
      alpha: { from: 0.62, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // Business contact footer. The WhatsApp action lives only on this menu.
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const phone = config?.contact.businessPhone ?? '6241548148';
    this.add
      .text(185, GAME_HEIGHT - 68, `DADDY POLLO\nTEL. ${phone}`, {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#9fdcff',
        stroke: '#06143a',
        strokeThickness: 4,
        letterSpacing: 1,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
    this.createWhatsAppOrderButton(505, GAME_HEIGHT - 68, phone);
    this.memberSessionPromise = this.restoreMemberSession();
  }

  /**
   * Active members are recognized on this browser with the registered phone
   * and revalidated against the server before premium access is displayed.
   */
  private async restoreMemberSession(): Promise<void> {
    const phone = storage.getPlayerPhone();
    if (!phone) return;
    const [player, serverMembership] = await Promise.all([
      api.lookupPlayer(phone),
      api.getMembershipStatus(phone),
    ]);
    const membership = import.meta.env.DEV
      ? withLocalDevelopmentAccess(storage.getMembership() ?? serverMembership)
      : serverMembership;
    if (!this.scene.isActive() || !player || !hasActiveMembership(membership)) return;

    membership.selectedOutfit = storage.getSelectedOutfit();
    membership.selectedWeapon = storage.getSelectedWeapon();
    this.rememberedPlayer = player;
    this.activeMembership = membership;
    storage.setMembership(membership);
    this.registry.set(REGISTRY.membership, membership);
    this.registry.set(REGISTRY.playerName, player.name ?? player.avatar);
    this.registry.set(REGISTRY.playerPhone, player.phone ?? phone);
    this.registry.set(REGISTRY.nickname, player.avatar);
    this.renderMemberBadge();
    this.renderRewardButton();
  }

  private async playPrimary(): Promise<void> {
    if (this.memberSessionPromise) {
      await this.memberSessionPromise;
    }
    const membership = this.activeMembership;
    const player = this.rememberedPlayer;
    if (hasActiveMembership(membership) && player) {
      const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
      const branch = storage.getBranch() ?? config?.branches[0]?.id ?? '';
      await this.startWithPlayer({
        name: player.name ?? player.avatar,
        avatar: player.avatar,
        phone: player.phone ?? storage.getPlayerPhone(),
        branch,
      });
      return;
    }
    await this.openRegistration();
  }

  private renderMemberBadge(): void {
    const membership = this.activeMembership;
    const player = this.rememberedPlayer;
    if (!this.memberBadge || !hasActiveMembership(membership) || !player) return;
    const plan = MEMBERSHIP_PLANS[membership.planId];
    const elite = plan.id === 'daddy-elite';
    const accent = elite ? 0x8b5cff : 0xffc928;
    const accentHex = elite ? '#d8c5ff' : '#ffe678';
    const symbol = elite ? '◆' : '★';
    this.memberBadge.removeAll(true);

    const glow = this.add
      .rectangle(0, 0, 518, 66, accent, 0.18)
      .setStrokeStyle(6, accent, 0.22);
    const background = this.add
      .rectangle(0, 0, 500, 56, 0x03112d, 0.96)
      .setStrokeStyle(2, accent, 1);
    const planLabel = this.add
      .text(0, -10, `${symbol}  ${plan.name} ACTIVO  ${symbol}`, {
        fontFamily: 'Arial Black, Trebuchet MS, sans-serif',
        fontSize: '19px',
        color: accentHex,
        stroke: '#020817',
        strokeThickness: 4,
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, accentHex, 10, true, true);
    const userLabel = this.add
      .text(0, 14, `SESIÓN INICIADA · ${player.avatar} ${player.name ?? ''}`.trim(), {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    this.memberBadge.add([glow, background, planLabel, userLabel]).setVisible(true);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 1 },
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private renderRewardButton(): void {
    this.rewardButton?.destroy(true);
    this.rewardButton = undefined;
    const membership = this.activeMembership;
    if (!hasActiveMembership(membership)) return;
    if (membership.planId === 'daddy-elite' && !membership.monthlyBenefit?.available) return;

    const elite = membership.planId === 'daddy-elite';
    const accent = elite ? 0x9c64ff : 0xffc928;
    const accentHex = elite ? '#eadfff' : '#fff0a3';
    const wrapper = this.add.container(64, 500).setDepth(40);
    const glow = this.add
      .circle(0, 0, 53, accent, 0.22)
      .setStrokeStyle(8, accent, 0.2)
      .setBlendMode(Phaser.BlendModes.ADD);
    const background = this.add
      .circle(0, 0, 44, 0x06142e, 0.98)
      .setStrokeStyle(4, accent, 1);
    const gift = this.add
      .text(0, -3, '🎁', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '43px',
      })
      .setOrigin(0.5);
    const available = this.add
      .text(0, 58, elite ? 'PREMIO\nDEL MES' : '10% DE\nDESCUENTO', {
        fontFamily: 'Arial Black, Trebuchet MS, sans-serif',
        fontSize: elite ? '12px' : '11px',
        color: accentHex,
        stroke: '#020817',
        strokeThickness: 4,
        align: 'center',
        lineSpacing: 1,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, accentHex, 8, true, true);
    const hitZone = this.add
      .circle(0, 10, 68, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    wrapper.add([glow, background, gift, available, hitZone]);
    hitZone.on('pointerover', () => wrapper.setScale(1.08));
    hitZone.on('pointerout', () => wrapper.setScale(1));
    hitZone.on('pointerup', () => void this.requestMembershipReward());
    this.tweens.add({
      targets: wrapper,
      y: { from: 491, to: 509 },
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 1 },
      scale: { from: 0.92, to: 1.1 },
      duration: 760,
      yoyo: true,
      repeat: -1,
    });
    this.rewardButton = wrapper;
  }

  private async requestMembershipReward(): Promise<void> {
    if (this.rewardClaiming) return;
    const membership = this.activeMembership;
    const phone = storage.getPlayerPhone();
    if (!hasActiveMembership(membership) || !phone) return;
    this.rewardClaiming = true;
    audioManager.unlock();
    audioManager.play('click');
    const popup = window.open('', '_blank');
    if (popup) popup.opener = null;
    try {
      const benefit = await api.claimMembershipBenefit(phone);
      const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
      const businessPhone = config?.contact.businessPhone ?? '6241548148';
      const identity = `${benefit.avatar}${benefit.memberName ? ` · ${benefit.memberName}` : ''}`;
      const message = benefit.planId === 'daddy-plus'
        ? [
          'Hola Daddy Pollo. Quiero usar mi beneficio de membresía.',
          `Miembro: ${identity}`,
          `Teléfono registrado: ${benefit.registeredPhone}`,
          'Plan: DADDY PLUS',
          'Premio: 10% de descuento en esta compra.',
        ].join('\n')
        : [
          'Hola Daddy Pollo. Solicito mi premio mensual de membresía.',
          `Miembro: ${identity}`,
          `Teléfono registrado: ${benefit.registeredPhone}`,
          'Plan: DADDY ELITE',
          `Periodo: ${benefit.period}`,
          'Premio: 1 papas con pollo chico gratis + 1 refresco de 325 ml gratis.',
          `Código: ${benefit.code}`,
        ].join('\n');
      const destination = buildWhatsAppUrl(businessPhone, message);

      if (benefit.planId === 'daddy-elite') {
        membership.monthlyBenefit = {
          available: false,
          label: benefit.label,
          code: benefit.code,
          redeemedAt: new Date().toISOString(),
          period: benefit.period ?? undefined,
        };
        storage.setMembership(membership);
        this.registry.set(REGISTRY.membership, membership);
        this.rewardButton?.destroy(true);
        this.rewardButton = undefined;
      }
      this.showMemberNotice(
        benefit.planId === 'daddy-elite'
          ? 'PREMIO DEL MES SOLICITADO'
          : 'BENEFICIO PLUS LISTO EN WHATSAPP',
        0x21e6c1,
      );
      if (popup) {
        popup.location.href = destination;
      } else {
        window.location.assign(destination);
      }
    } catch (error) {
      popup?.close();
      const message = error instanceof Error ? error.message : 'No pudimos solicitar el premio.';
      if (membership.planId === 'daddy-elite' && message.toLowerCase().includes('ya fue')) {
        membership.monthlyBenefit = membership.monthlyBenefit
          ? { ...membership.monthlyBenefit, available: false }
          : null;
        storage.setMembership(membership);
        this.rewardButton?.destroy(true);
        this.rewardButton = undefined;
      }
      this.showMemberNotice(message.toUpperCase(), 0xff556d);
    } finally {
      this.rewardClaiming = false;
    }
  }

  private showMemberNotice(message: string, color: number): void {
    const notice = this.add.container(GAME_WIDTH / 2, 470).setDepth(100);
    const background = this.add
      .rectangle(0, 0, 570, 70, 0x020817, 0.98)
      .setStrokeStyle(3, color, 1);
    const label = this.add
      .text(0, 0, message, {
        fontFamily: 'Arial Black, Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5);
    notice.add([background, label]).setAlpha(0);
    this.tweens.add({
      targets: notice,
      alpha: 1,
      y: 450,
      duration: 220,
      yoyo: true,
      hold: 2200,
      onComplete: () => notice.destroy(true),
    });
  }

  private openInstallModule(): void {
    this.scene.start(SCENES.Install);
    // This call remains inside the menu-button gesture. Chromium requires that
    // user activation in order to display its native PWA installer.
    void pwaManager.promptInstall();
  }

  private createWhatsAppOrderButton(x: number, y: number, phone: string): void {
    const width = 292;
    const height = 68;
    const whatsappGreen = 0x25d366;
    const wrapper = this.add.container(x, y);
    const button = this.add.container(0, 0);
    const glow = this.add.graphics();
    const background = this.add.graphics();

    type ButtonState = 'normal' | 'hover' | 'pressed';
    const drawButton = (state: ButtonState): void => {
      const hovered = state === 'hover';
      const pressed = state === 'pressed';
      const inset = pressed ? 2 : 0;

      glow.clear();
      background.clear();
      glow.fillStyle(whatsappGreen, hovered ? 0.32 : 0.2);
      glow.fillRoundedRect(-width / 2 - 8, -height / 2 - 8, width + 16, height + 16, 28);
      glow.lineStyle(hovered ? 8 : 5, whatsappGreen, hovered ? 0.35 : 0.2);
      glow.strokeRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 25);

      background.fillStyle(0x020817, 0.5);
      background.fillRoundedRect(-width / 2 + 4, -height / 2 + 7, width, height, 23);
      background.fillStyle(whatsappGreen, 1);
      background.fillRoundedRect(
        -width / 2 + inset,
        -height / 2 + inset,
        width - inset * 2,
        height - inset * 2,
        22,
      );
      background.lineStyle(hovered ? 4 : 3, 0xffffff, hovered ? 1 : 0.9);
      background.strokeRoundedRect(
        -width / 2 + inset,
        -height / 2 + inset,
        width - inset * 2,
        height - inset * 2,
        22,
      );
      background.fillStyle(0xffffff, hovered ? 0.2 : 0.13);
      background.fillRoundedRect(-width / 2 + 8, -height / 2 + 7, width - 16, 18, 10);
    };
    drawButton('normal');

    // Code-native WhatsApp-style mark: speech bubble plus handset.
    const icon = this.add.graphics();
    icon.fillStyle(0xffffff, 1);
    icon.fillCircle(-108, 0, 21);
    icon.fillTriangle(-121, 14, -127, 24, -113, 19);
    icon.fillStyle(whatsappGreen, 1);
    icon.fillCircle(-108, 0, 16);
    const handset = this.add
      .text(-108, -1, '☎', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const channelLabel = this.add
      .text(20, -14, 'WHATSAPP', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#dfffea',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    const actionLabel = this.add
      .text(20, 9, 'PEDIR DE COMER', {
        fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
        fontSize: '23px',
        color: '#ffffff',
        stroke: '#075c2a',
        strokeThickness: 2,
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffffff', 5, true, true);
    const hitZone = this.add
      .zone(0, 0, width + 18, height + 12)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.add([glow, background, icon, handset, channelLabel, actionLabel, hitZone]);
    button.setSize(width, height);
    wrapper.add(button);

    const animateScale = (scale: number, duration: number): void => {
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, scale, duration, ease: 'Quad.out' });
    };
    let activePointerId: number | null = null;

    hitZone.on('pointerover', () => {
      drawButton('hover');
      animateScale(1.025, 100);
    });
    hitZone.on('pointerout', () => {
      drawButton('normal');
      animateScale(1, 110);
    });
    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (activePointerId !== null) {
        return;
      }
      activePointerId = pointer.id;
      drawButton('pressed');
      animateScale(0.97, 55);
    });
    hitZone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (activePointerId !== pointer.id) {
        return;
      }
      activePointerId = null;
      drawButton('hover');
      animateScale(1.025, 80);
      audioManager.unlock();
      audioManager.play('click');
      window.open(buildWhatsAppUrl(phone, FOOD_ORDER_MESSAGE), '_blank', 'noopener');
    });
    hitZone.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      if (activePointerId === pointer.id) {
        activePointerId = null;
        drawButton('normal');
        animateScale(1, 80);
      }
    });

    this.tweens.add({
      targets: wrapper,
      y: { from: y - 3, to: y + 3 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.72, to: 1 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private createSoundToggle(x: number, y: number): void {
    const label = () => (audioManager.isEnabled() ? '🔊 SONIDO: SÍ' : '🔇 SONIDO: NO');
    const hitArea = this.add
      .rectangle(x, y, 290, 58, 0x071d4d, 0.82)
      .setStrokeStyle(2, COLORS.neon, 0.72)
      .setInteractive({ useHandCursor: true });
    this.soundButton = this.add
      .text(x, y, label(), {
        fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
        fontSize: '23px',
        color: '#ffd21e',
        stroke: '#06143a',
        strokeThickness: 4,
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffd21e', 8, true, true);

    hitArea.on('pointerover', () => {
      hitArea.setFillStyle(0x0b3778, 0.95).setStrokeStyle(3, COLORS.neon, 1);
      this.soundButton?.setScale(1.04);
    });
    hitArea.on('pointerout', () => {
      hitArea.setFillStyle(0x071d4d, 0.82).setStrokeStyle(2, COLORS.neon, 0.72);
      this.soundButton?.setScale(1);
    });
    hitArea.on('pointerup', () => {
      const enabled = audioManager.toggle();
      this.registry.set(REGISTRY.soundEnabled, enabled);
      this.soundButton?.setText(label());
      if (enabled) {
        audioManager.unlock();
        audioManager.play('click');
      }
    });
  }

  private async openRegistration(): Promise<void> {
    if (this.formOpen || this.transitioning) {
      return;
    }
    this.formOpen = true;
    this.input.enabled = false;
    audioManager.unlock();
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const branches = config?.branches ?? [];

    try {
      const data = await showRegistrationForm(branches, {
        name: '',
        avatar: '',
        phone: '',
        branch: branches[0]?.id ?? '',
      });

      if (data && this.scene.isActive()) {
        this.startWithPlayer(data);
      }
    } finally {
      this.formOpen = false;
      if (this.scene.isActive() && !this.transitioning) {
        this.input.enabled = true;
        this.scale.refresh();
      }
    }
  }

  private async openReturning(): Promise<void> {
    if (this.formOpen || this.transitioning) {
      return;
    }
    this.formOpen = true;
    this.input.enabled = false;
    audioManager.unlock();
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const branches = config?.branches ?? [];
    const rememberedPhone = storage.getPlayerPhone();

    let openRegistrationNext = false;
    try {
      // Recognize the last registered player on this browser. The server still
      // confirms that the remembered phone belongs to an existing account.
      const rememberedPlayer = rememberedPhone
        ? await api.lookupPlayer(rememberedPhone)
        : null;
      const result = await showReturningPlayerForm(
        branches,
        (phone) => api.lookupPlayer(phone),
        {
          phone: rememberedPhone,
          branch: storage.getBranch() ?? branches[0]?.id ?? '',
        },
        rememberedPlayer,
      );

      if (result === 'register') {
        openRegistrationNext = true;
      } else if (result && this.scene.isActive()) {
        this.startWithPlayer(result);
      }
    } finally {
      this.formOpen = false;
      if (this.scene.isActive() && !this.transitioning) {
        this.input.enabled = true;
        this.scale.refresh();
      }
    }

    if (openRegistrationNext && this.scene.isActive()) {
      void this.openRegistration();
    }
  }

  /** Persist the player info and start the game. */
  private async startWithPlayer(data: RegistrationData): Promise<void> {
    if (this.transitioning) {
      return;
    }
    this.transitioning = true;
    this.registry.set(REGISTRY.playerName, data.name);
    this.registry.set(REGISTRY.playerPhone, data.phone);
    this.registry.set(REGISTRY.nickname, data.avatar);
    this.registry.set(REGISTRY.selectedBranch, data.branch);
    storage.setNickname(data.avatar);
    storage.setBranch(data.branch);
    storage.setPlayerPhone(data.phone);
    void pwaManager.syncPushSubscription();

    audioManager.play('click');
    removeRegistrationOverlays();
    this.input.enabled = false;
    this.scale.refresh();
    const cachedMembership = storage.getMembership();
    if (cachedMembership) {
      this.registry.set(REGISTRY.membership, cachedMembership);
    }
    const serverMembership = await api.getMembershipStatus(data.phone);
    const membership = import.meta.env.DEV
      ? withLocalDevelopmentAccess(cachedMembership ?? serverMembership)
      : serverMembership;
    membership.selectedOutfit = storage.getSelectedOutfit();
    membership.selectedWeapon = storage.getSelectedWeapon();
    storage.setMembership(membership);
    this.registry.set(REGISTRY.membership, membership);
    this.scene.start(SCENES.Game);
  }

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x123fb2, 0x0b2d82, 0x03091f, 0x071d4d, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Futuristic grid and energy rails give the portrait canvas visual depth.
    const grid = this.add.graphics();
    grid.lineStyle(2, COLORS.neon, 0.08);
    for (let y = 70; y < GAME_HEIGHT; y += 80) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x <= GAME_WIDTH; x += 72) {
      grid.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    grid.lineStyle(4, COLORS.neon, 0.22);
    grid.lineBetween(34, 0, 34, GAME_HEIGHT);
    grid.lineBetween(GAME_WIDTH - 34, 0, GAME_WIDTH - 34, GAME_HEIGHT);
    grid.setBlendMode(Phaser.BlendModes.ADD);

    const halo = this.add.circle(GAME_WIDTH / 2, 420, 310, COLORS.blueLight, 0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      scale: { from: 0.88, to: 1.08 },
      alpha: { from: 0.12, to: 0.3 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Deterministic particles keep the menu lively without distracting from
    // the controls or changing between visits.
    const particlePositions = [
      [72, 150], [642, 206], [92, 352], [625, 442], [58, 612], [664, 720],
      [79, 866], [635, 970], [112, 1100], [590, 1170], [188, 92], [530, 80],
    ];
    particlePositions.forEach(([px, py], index) => {
      const color = index % 3 === 0 ? COLORS.yellow : index % 3 === 1 ? COLORS.neon : 0x43d9ff;
      const particle = this.add.circle(px, py, 2 + (index % 3), color, 0.72).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        y: py - 24 - (index % 4) * 7,
        alpha: { from: 0.25, to: 0.95 },
        duration: 1300 + index * 95,
        delay: index * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });

    if (this.textures.exists('fondo-los-cabos')) {
      this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'fondo-los-cabos')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.18);
    }
  }
}
