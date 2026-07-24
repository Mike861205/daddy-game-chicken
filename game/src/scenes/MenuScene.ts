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

const FOOD_ORDER_MESSAGE = 'Quiero pedir de comer a Daddy Pollo, ¿me regalas el menú?';

/**
 * MenuScene: logo, main buttons, sound toggle and player registration.
 */
export class MenuScene extends Phaser.Scene {
  private soundButton?: Phaser.GameObjects.Text;
  private formOpen = false;
  private transitioning = false;

  constructor() {
    super(SCENES.Menu);
  }

  create(): void {
    this.formOpen = false;
    this.transitioning = false;
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
    createButton(this, cx, 570, 'JUGAR', () => void this.openRegistration(), {
      width: 500,
      height: 78,
      fontSize: 34,
      fillColor: COLORS.red,
      textColor: '#ffffff',
      glowColor: 0xff2748,
    });
    createButton(this, cx, 670, '¿YA JUGASTE ANTES?', () => void this.openReturning(), {
      width: 500,
      height: 74,
      fontSize: 27,
      fillColor: COLORS.green,
      textColor: '#ffffff',
      glowColor: 0x39ff6e,
    });
    createButton(this, cx, 770, 'CÓMO JUGAR', () => this.scene.start(SCENES.Instructions), {
      width: 500,
      height: 76,
      fontSize: 30,
      glowColor: COLORS.yellow,
    });
    createButton(this, cx, 870, 'MEJORES PUNTAJES', () => this.scene.start(SCENES.Leaderboard), {
      width: 500,
      height: 76,
      fontSize: 28,
      glowColor: 0x43d9ff,
    });
    createButton(this, cx, 965, 'DESCARGA LA APP', () => this.openInstallModule(), {
      width: 500,
      height: 70,
      fontSize: 27,
      fillColor: 0x6f46d9,
      textColor: '#ffffff',
      glowColor: 0xb66cff,
    });

    // Sound toggle.
    this.createSoundToggle(cx, 1055);

    const arsenalBadge = this.add
      .text(cx, 1132, '⚔ NUEVO COMBATE: CORRE • DISPARA • CÚBRETE', {
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
  private startWithPlayer(data: RegistrationData): void {
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

    audioManager.play('click');
    removeRegistrationOverlays();
    this.input.enabled = false;
    this.scale.refresh();
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
