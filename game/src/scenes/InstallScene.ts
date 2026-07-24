import Phaser from 'phaser';
import {
  COLORS,
  COLORS_HEX,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENES,
} from '../config/constants.js';
import { pwaManager, type PwaState } from '../services/pwa.js';
import { createButton } from '../utils/ui.js';

/**
 * InstallScene: platform-specific PWA installation and notification guidance.
 */
export class InstallScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private installButton!: Phaser.GameObjects.Container;
  private notificationButton!: Phaser.GameObjects.Container;
  private unsubscribe?: () => void;

  constructor() {
    super(SCENES.Install);
  }

  create(): void {
    this.drawBackground();
    const cx = GAME_WIDTH / 2;

    const hero = this.add.graphics();
    hero.fillGradientStyle(0x183b91, 0x52248e, 0x07163f, 0x0b2b65, 0.96);
    hero.fillRoundedRect(30, 28, 660, 266, 30);
    hero.lineStyle(3, 0x43d9ff, 0.62);
    hero.strokeRoundedRect(30, 28, 660, 266, 30);
    hero.lineStyle(1, 0xffffff, 0.12);
    hero.strokeRoundedRect(40, 38, 640, 246, 24);

    const heroShine = this.add.ellipse(575, 62, 250, 115, 0xb66cff, 0.14);
    heroShine.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: heroShine,
      x: { from: 525, to: 600 },
      alpha: { from: 0.1, to: 0.23 },
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.add
      .text(465, 59, 'TU JUEGO, SIEMPRE CONTIGO', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: COLORS_HEX.neon,
        letterSpacing: 2.8,
      })
      .setOrigin(0.5);

    const iconCard = this.add.graphics();
    iconCard.fillStyle(0x020817, 0.72);
    iconCard.fillRoundedRect(58, 70, 198, 198, 38);
    iconCard.lineStyle(4, COLORS.neon, 0.72);
    iconCard.strokeRoundedRect(58, 70, 198, 198, 38);
    iconCard.lineStyle(9, 0xb66cff, 0.13);
    iconCard.strokeRoundedRect(65, 77, 184, 184, 32);

    const iconHalo = this.add.circle(157, 169, 87, 0x6f46d9, 0.28);
    iconHalo.setStrokeStyle(3, COLORS.neon, 0.5);
    this.tweens.add({
      targets: iconHalo,
      scale: { from: 0.94, to: 1.06 },
      alpha: { from: 0.55, to: 1 },
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const icon = this.add.image(157, 169, 'daddy-pollo-pwa').setOrigin(0.5);
    icon.setDisplaySize(164, 164);
    this.add
      .text(465, 105, 'DADDY POLLO', {
        fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
        fontSize: '43px',
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 6,
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(465, 158, 'Instala una vez. Juega cuando quieras.', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#d8eaff',
      })
      .setOrigin(0.5);

    this.createFeaturePill(360, 193, 150, 'ACCESO RÁPIDO', 0x43d9ff);
    this.createFeaturePill(545, 193, 160, 'PANTALLA APP', 0xb66cff);
    this.createFeaturePill(452, 237, 300, 'SIN TIENDA  •  INSTALACIÓN GRATIS', COLORS.green);

    this.add
      .text(36, 320, 'ELIGE TU DISPOSITIVO', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
        letterSpacing: 1.8,
      })
      .setOrigin(0, 0.5);
    const timeBadge = this.add.graphics();
    timeBadge.fillStyle(COLORS.neon, 0.13);
    timeBadge.fillRoundedRect(573, 302, 112, 36, 18);
    timeBadge.lineStyle(2, COLORS.neon, 0.5);
    timeBadge.strokeRoundedRect(573, 302, 112, 36, 18);
    this.add
      .text(629, 320, '≈ 1 MIN', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: COLORS_HEX.neon,
        letterSpacing: 1.2,
      })
      .setOrigin(0.5);

    this.createPlatformCard(
      30,
      350,
      320,
      356,
      'ANDROID',
      'DESDE GOOGLE CHROME',
      'AND',
      [
        'Abre el juego usando Chrome.',
        'Toca “Instalar Daddy Pollo”.',
        'Confirma pulsando “Instalar”.',
        'Abre el icono desde tus apps.',
      ],
      0x25d366,
    );
    this.createPlatformCard(
      370,
      350,
      320,
      356,
      'IPHONE / IPAD',
      'DESDE SAFARI',
      'iOS',
      [
        'Abre el juego usando Safari.',
        'Toca el botón Compartir  □↑',
        'Elige “Añadir a pantalla de inicio”.',
        'Confirma pulsando “Añadir”.',
      ],
      0x43d9ff,
    );

    const reminderCard = this.add.graphics();
    reminderCard.fillGradientStyle(0x102e66, 0x18265d, 0x071637, 0x0a214d, 0.96);
    reminderCard.fillRoundedRect(30, 730, 660, 124, 25);
    reminderCard.lineStyle(2, 0xffd21e, 0.68);
    reminderCard.strokeRoundedRect(30, 730, 660, 124, 25);
    reminderCard.fillStyle(0xffd21e, 0.14);
    reminderCard.fillCircle(91, 792, 38);
    reminderCard.lineStyle(2, 0xffd21e, 0.6);
    reminderCard.strokeCircle(91, 792, 38);
    this.add
      .text(91, 791, '🔔', {
        fontFamily: '"Segoe UI Emoji", Arial, sans-serif',
        fontSize: '30px',
      })
      .setOrigin(0.5);
    this.add
      .text(145, 757, 'RECORDATORIOS DE JUEGO', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(
        145,
        793,
        'Activa las notificaciones para recordar volver a jugar.\nEn iPhone/iPad: iOS 16.4+ y la app abierta desde Inicio.',
        {
          fontFamily: 'Trebuchet MS, Arial, sans-serif',
          fontSize: '15px',
          color: '#bfeaff',
          lineSpacing: 5,
          wordWrap: { width: 490 },
        },
      )
      .setOrigin(0, 0.5);
    const iosBadge = this.add.graphics();
    iosBadge.fillStyle(0x43d9ff, 0.15);
    iosBadge.fillRoundedRect(550, 747, 116, 30, 15);
    iosBadge.lineStyle(1, 0x43d9ff, 0.65);
    iosBadge.strokeRoundedRect(550, 747, 116, 30, 15);
    this.add
      .text(608, 762, 'iOS 16.4+', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#8ceaff',
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    const statusPill = this.add.graphics();
    statusPill.fillStyle(0x020817, 0.7);
    statusPill.fillRoundedRect(54, 873, 612, 60, 30);
    statusPill.lineStyle(2, COLORS.neon, 0.36);
    statusPill.strokeRoundedRect(54, 873, 612, 60, 30);

    this.statusText = this.add
      .text(cx, 903, 'Preparando instalador…', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: COLORS_HEX.neon,
        stroke: '#06143a',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 565 },
      })
      .setOrigin(0.5);

    this.installButton = createButton(
      this,
      cx,
      982,
      'INSTALAR DADDY POLLO',
      () => void this.requestInstall(),
      {
        width: 500,
        height: 72,
        fontSize: 27,
        fillColor: 0x6f46d9,
        textColor: '#ffffff',
        glowColor: 0xb66cff,
      },
    );
    this.notificationButton = createButton(
      this,
      cx,
      1072,
      'ACTIVAR RECORDATORIOS',
      () => void this.requestNotifications(),
      {
        width: 500,
        height: 68,
        fontSize: 25,
        fillColor: COLORS.green,
        textColor: '#ffffff',
        glowColor: 0x39ff6e,
      },
    );
    createButton(this, cx, 1164, 'VOLVER AL MENÚ', () => this.scene.start(SCENES.Menu), {
      width: 360,
      height: 64,
      fontSize: 25,
      fillColor: COLORS.red,
      textColor: '#ffffff',
    });
    this.add
      .text(cx, 1232, 'PWA SEGURA  •  DADDY POLLO', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#739bcc',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.unsubscribe = pwaManager.subscribe((state) => this.renderPwaState(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    });
  }

  private createFeaturePill(
    x: number,
    y: number,
    width: number,
    label: string,
    accent: number,
  ): void {
    const pill = this.add.graphics();
    pill.fillStyle(accent, 0.13);
    pill.fillRoundedRect(x - width / 2, y - 16, width, 32, 16);
    pill.lineStyle(1, accent, 0.6);
    pill.strokeRoundedRect(x - width / 2, y - 16, width, 32, 16);
    this.add
      .text(x, y, label, {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
  }

  private createPlatformCard(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    subtitle: string,
    platformMark: string,
    steps: string[],
    accent: number,
  ): void {
    const panel = this.add.graphics();
    panel.fillGradientStyle(0x0d2a61, 0x0b2455, 0x040d29, 0x07183c, 0.96);
    panel.fillRoundedRect(x, y, width, height, 27);
    panel.lineStyle(3, accent, 0.8);
    panel.strokeRoundedRect(x, y, width, height, 27);
    panel.fillStyle(accent, 0.16);
    panel.fillRoundedRect(x + 9, y + 9, width - 18, 71, 19);
    panel.fillStyle(accent, 0.85);
    panel.fillRoundedRect(x + 18, y + 18, 52, 52, 15);
    panel.fillStyle(accent, 0.8);
    panel.fillRoundedRect(x + 20, y + height - 9, width - 40, 4, 2);

    this.add
      .text(x + 44, y + 44, platformMark, {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: platformMark === 'iOS' ? '17px' : '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(x + 84, y + 29, title, {
        fontFamily: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
        fontSize: '23px',
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 3,
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 84, y + 56, subtitle, {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: `#${accent.toString(16).padStart(6, '0')}`,
        letterSpacing: 1.2,
      })
      .setOrigin(0, 0.5);

    steps.forEach((step, index) => {
      const stepY = y + 111 + index * 58;
      if (index < steps.length - 1) {
        const connector = this.add.graphics();
        connector.lineStyle(2, accent, 0.28);
        connector.lineBetween(x + 37, stepY + 17, x + 37, stepY + 42);
      }
      const badge = this.add.graphics();
      badge.fillStyle(accent, 0.18);
      badge.fillCircle(x + 37, stepY, 17);
      badge.lineStyle(2, accent, 0.78);
      badge.strokeCircle(x + 37, stepY, 17);
      this.add
        .text(x + 37, stepY, String(index + 1), {
          fontFamily: 'Trebuchet MS, Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.add
        .text(x + 66, stepY, step, {
          fontFamily: 'Trebuchet MS, Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#eaf5ff',
          lineSpacing: 2,
          wordWrap: { width: width - 88 },
        })
        .setOrigin(0, 0.5);
    });
  }

  private renderPwaState(state: PwaState): void {
    if (!this.statusText?.active) {
      return;
    }

    if (state.installed) {
      this.statusText
        .setColor(COLORS_HEX.green)
        .setText('✓ Daddy Pollo ya está instalada en este dispositivo.');
      this.installButton.setVisible(false);
    } else if (state.installOutcome === 'dismissed') {
      this.statusText
        .setColor(COLORS_HEX.yellow)
        .setText('Instalación cancelada. Puedes intentarlo nuevamente desde el menú del navegador.');
      this.installButton.setVisible(false);
    } else if (state.platform === 'ios') {
      this.statusText
        .setColor('#43d9ff')
        .setText('En iPhone/iPad usa Compartir → Añadir a pantalla de inicio.');
      this.installButton.setVisible(false);
    } else if (state.canPromptInstall) {
      this.statusText
        .setColor(COLORS_HEX.neon)
        .setText('La app está lista. Pulsa instalar si el aviso no apareció automáticamente.');
      this.installButton.setVisible(true);
    } else {
      this.statusText
        .setColor('#bfeaff')
        .setText('Usa el menú de Chrome o Safari y selecciona “Instalar app” o “Añadir a inicio”.');
      this.installButton.setVisible(false);
    }

    const notificationsEnabled = state.notificationPermission === 'granted';
    this.notificationButton.setVisible(!notificationsEnabled);
    if (notificationsEnabled) {
      this.statusText
        .setColor(COLORS_HEX.green)
        .setText(
          state.periodicRemindersEnabled
            ? '✓ Daddy Pollo está instalada y los recordatorios están activados.'
            : '✓ Las notificaciones están permitidas en este dispositivo.',
        );
    }
  }

  private async requestInstall(): Promise<void> {
    this.statusText.setColor(COLORS_HEX.neon).setText('Abriendo el instalador…');
    const outcome = await pwaManager.promptInstall();
    if (outcome === 'unavailable') {
      this.statusText
        .setColor(COLORS_HEX.yellow)
        .setText('Abre el menú del navegador y selecciona “Instalar app”.');
    }
  }

  private async requestNotifications(): Promise<void> {
    this.statusText.setColor(COLORS_HEX.neon).setText('Solicitando permiso…');
    const outcome = await pwaManager.requestNotifications();
    if (!this.scene.isActive()) {
      return;
    }

    if (outcome === 'granted') {
      const remindersEnabled = pwaManager.getState().periodicRemindersEnabled;
      this.statusText
        .setColor(COLORS_HEX.green)
        .setText(
          remindersEnabled
            ? '✓ Recordatorios automáticos activados. Recibirás una notificación de confirmación.'
            : '✓ Notificaciones permitidas. Los avisos automáticos dependen de las funciones de tu teléfono.',
        );
    } else if (outcome === 'denied') {
      this.statusText
        .setColor(COLORS_HEX.yellow)
        .setText('Permiso bloqueado. Actívalo desde los ajustes de notificaciones del navegador.');
    } else if (outcome === 'install-first') {
      this.statusText
        .setColor('#43d9ff')
        .setText('En iPhone/iPad primero añade Daddy Pollo a Inicio y ábrela desde su icono.');
    } else if (outcome === 'unsupported') {
      this.statusText
        .setColor(COLORS_HEX.yellow)
        .setText('Este navegador no admite notificaciones para la app.');
    } else {
      this.statusText
        .setColor(COLORS_HEX.red)
        .setText('No fue posible activar los recordatorios. Intenta nuevamente.');
    }
  }

  private drawBackground(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0x123d9d, 0x0a286f, 0x010615, 0x071b48, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const purpleAurora = this.add.circle(665, 238, 270, 0x8b3dff, 0.12);
    purpleAurora.setBlendMode(Phaser.BlendModes.ADD);
    const cyanAurora = this.add.circle(36, 900, 240, 0x21e6c1, 0.09);
    cyanAurora.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: [purpleAurora, cyanAurora],
      scale: { from: 0.9, to: 1.13 },
      alpha: { from: 0.45, to: 0.9 },
      duration: 2700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const grid = this.add.graphics();
    grid.lineStyle(2, COLORS.neon, 0.055);
    for (let y = 40; y < GAME_HEIGHT; y += 64) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x < GAME_WIDTH; x += 64) {
      grid.lineBetween(x, 0, x, GAME_HEIGHT);
    }
  }
}
