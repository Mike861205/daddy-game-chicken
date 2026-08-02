import Phaser from 'phaser';
import {
  EMPTY_MEMBERSHIP,
  MEMBERSHIP_PLANS,
  OUTFITS,
  PREMIUM_WEAPONS,
  hasActiveMembership,
  isOutfitAvailable,
  isEliteMembership,
  withLocalDevelopmentAccess,
  type MembershipEntitlement,
  type MembershipPlanId,
  type OutfitId,
  type PremiumWeaponId,
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
import {
  removeRegistrationOverlays,
  showRegistrationForm,
} from '../services/registrationForm.js';
import { storage } from '../services/storage.js';
import type { PublicConfig } from '../types.js';

type MembershipTab = 'plans' | 'wardrobe' | 'arsenal';

interface AnimatedCharacterRig {
  root: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Container;
  hands: Phaser.GameObjects.Container;
  leftFoot: Phaser.GameObjects.Container;
  rightFoot: Phaser.GameObjects.Container;
}

/**
 * Branded membership hub. Stripe Checkout is server-created; this scene never
 * receives card data or secret keys.
 */
export class MembershipScene extends Phaser.Scene {
  private content?: Phaser.GameObjects.Container;
  private tab: MembershipTab = 'plans';
  private membership: MembershipEntitlement = { ...EMPTY_MEMBERSHIP };
  private statusText?: Phaser.GameObjects.Text;
  private toast?: Phaser.GameObjects.Container;
  private registrationOpen = false;

  constructor() {
    super(SCENES.Membership);
  }

  create(): void {
    removeRegistrationOverlays();
    this.input.enabled = true;
    this.membership = withLocalDevelopmentAccess(
      storage.getMembership() ?? { ...EMPTY_MEMBERSHIP },
    );
    this.membership.selectedOutfit = storage.getSelectedOutfit();
    this.membership.selectedWeapon = storage.getSelectedWeapon();
    this.registry.set(REGISTRY.membership, this.membership);
    this.drawBackground();
    this.createHeader();
    this.createTabs();
    this.renderTab();
    void this.refreshMembership();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, removeRegistrationOverlays);
  }

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x123fb2, 0x071d4d, 0x020817, 0x07152e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const grid = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    grid.lineStyle(2, COLORS.neon, 0.08);
    for (let y = 0; y <= GAME_HEIGHT; y += 72) grid.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 0; x <= GAME_WIDTH; x += 72) grid.lineBetween(x, 0, x, GAME_HEIGHT);

    const halo = this.add
      .circle(GAME_WIDTH / 2, 380, 320, 0x1450c8, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      scale: { from: 0.86, to: 1.12 },
      alpha: { from: 0.1, to: 0.25 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private createHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 42, 'JUEGA CON MEMBRESIA', {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '45px',
        color: COLORS_HEX.white,
        stroke: '#06143a',
        strokeThickness: 7,
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 0, '#21e6c1', 12, true, true);
    this.add
      .text(GAME_WIDTH / 2, 103, 'MAS SABOR. MAS PODER. CADA MES.', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '17px',
        color: COLORS_HEX.yellow,
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 138, '', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: '#9fdcff',
        stroke: '#020817',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.updateStatusLabel();

    this.makeAction(58, 58, 76, 58, '‹', 0x071d4d, () => {
      audioManager.play('click');
      this.scene.start(SCENES.Menu);
    }, 38);
  }

  private createTabs(): void {
    const tabs: { id: MembershipTab; label: string }[] = [
      { id: 'plans', label: 'PLANES' },
      { id: 'wardrobe', label: 'VESTIDOR' },
      { id: 'arsenal', label: 'ARSENAL' },
    ];
    tabs.forEach((entry, index) => {
      const x = 130 + index * 230;
      const box = this.add
        .rectangle(x, 190, 205, 58, entry.id === this.tab ? COLORS.red : 0x071d4d, 0.96)
        .setStrokeStyle(3, entry.id === this.tab ? COLORS.yellow : COLORS.neon, 0.9)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, 190, entry.label, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '19px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      box.on('pointerup', () => {
        if (this.tab === entry.id) return;
        this.tab = entry.id;
        audioManager.play('click');
        this.scene.restart();
      });
      box.on('pointerover', () => label.setScale(1.05));
      box.on('pointerout', () => label.setScale(1));
    });
  }

  private renderTab(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 235);
    if (this.tab === 'wardrobe') {
      this.renderWardrobe();
    } else if (this.tab === 'arsenal') {
      this.renderArsenal();
    } else {
      this.renderPlans();
    }
  }

  private renderPlans(): void {
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, 11, 'ELIGE TU NIVEL DE PODER', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '20px',
        color: COLORS_HEX.yellow,
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, 43, 'Beneficios exclusivos protegidos por tu teléfono', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '15px',
        color: '#cfe0ff',
      })
      .setOrigin(0.5);
    this.content?.add([eyebrow, subtitle]);

    this.addPlanCard(188, 422, MEMBERSHIP_PLANS['daddy-plus']);
    this.addPlanCard(532, 422, MEMBERSHIP_PLANS['daddy-elite']);
    this.addTrustBadge(190, 824, 'PAGO SEGURO', 'secure', COLORS.neon);
    this.addTrustBadge(530, 824, 'MEMBRESÍA MENSUAL', 'monthly', COLORS.yellow);
    const note = this.add
      .text(GAME_WIDTH / 2, 875, 'Procesado por Stripe  •  Cancela cuando quieras', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#b9c9e8',
      })
      .setOrigin(0.5);
    this.content?.add(note);
  }

  private addPlanCard(
    x: number,
    y: number,
    plan: (typeof MEMBERSHIP_PLANS)[MembershipPlanId],
  ): void {
    const width = 318;
    const height = 708;
    const wrapper = this.add.container(x, y);
    const glow = this.add
      .rectangle(0, 0, width + 16, height + 16, plan.accent, 0.13)
      .setStrokeStyle(6, plan.accent, 0.24);
    const card = this.add
      .rectangle(0, 0, width, height, 0x06142e, 0.985)
      .setStrokeStyle(4, plan.color, 1);
    const innerGlow = this.add
      .rectangle(0, -65, width - 20, height - 150, plan.color, 0.035)
      .setStrokeStyle(1, plan.accent, 0.22);
    const band = this.add
      .rectangle(0, -height / 2 + 42, width - 4, 80, plan.color, 0.98);
    const badge = this.add
      .text(0, -height / 2 + 42, plan.badge, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    const name = this.add
      .text(0, -height / 2 + 103, plan.name, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '31px',
        color: '#ffffff',
        stroke: '#020817',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const portraitHalo = this.add
      .circle(-86, -height / 2 + 180, 59, plan.accent, 0.14)
      .setStrokeStyle(2, plan.accent, 0.54);
    const portrait = this.createAnimatedCharacterRig(
      -86,
      -height / 2 + 177,
      plan.id === 'daddy-plus' ? 'skin-comandante-neon' : 'skin-rey-sabor',
      128,
      1,
      plan.id === 'daddy-plus' ? 0 : 420,
    );
    const price = this.add
      .text(61, -height / 2 + 165, `$${plan.price}`, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '49px',
        color: plan.colorHex,
        stroke: '#020817',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const period = this.add
      .text(61, -height / 2 + 205, 'MXN / MES', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '12px',
        color: '#cfe0ff',
      })
      .setOrigin(0.5);
    const separator = this.add
      .rectangle(0, -height / 2 + 242, width - 38, 2, plan.accent, 0.55);
    const benefits = plan.benefits.map((benefit, index) =>
      this.add
        .text(-width / 2 + 22, -height / 2 + 265 + index * 67, `✓  ${benefit}`, {
          fontFamily: 'Trebuchet MS, Arial, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
          wordWrap: { width: width - 44, useAdvancedWrap: true },
          lineSpacing: 2,
        })
        .setOrigin(0, 0),
    );
    const active = hasActiveMembership(this.membership) && this.membership.planId === plan.id;
    const actionLabel = active
      ? '✓ PLAN ACTIVO'
      : import.meta.env.DEV
        ? `ACTIVAR ${plan.name.replace('DADDY ', '')} DEMO`
        : `ELEGIR ${plan.name.replace('DADDY ', '')}`;
    const button = this.makeAction(
      0,
      height / 2 - 73,
      270,
      62,
      actionLabel,
      active ? 0x27c93f : plan.color,
      () => {
        if (!active) {
          if (import.meta.env.DEV) {
            this.activateDemo(plan.id);
          } else {
            void this.startCheckout(plan.id);
          }
        }
      },
      18,
    );
    const product = this.add
      .text(0, height / 2 - 25, `ID ${plan.productId}`, {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '10px',
        color: '#7185aa',
      })
      .setOrigin(0.5);
    wrapper.add([
      glow,
      card,
      innerGlow,
      band,
      badge,
      name,
      portraitHalo,
      portrait.root,
      price,
      period,
      separator,
      ...benefits,
      button,
      product,
    ]);
    this.content?.add(wrapper);

    if (import.meta.env.DEV) {
      const demo = this.add
        .text(x, 915, 'PROBAR DEMO', {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '11px',
          color: '#9fdcff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      demo.on('pointerup', () => this.activateDemo(plan.id));
      this.content?.add(demo);
    }
  }

  private addTrustBadge(
    x: number,
    y: number,
    label: string,
    kind: 'secure' | 'monthly',
    color: number,
  ): void {
    const badge = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 290, 66, 0x07152e, 0.96)
      .setStrokeStyle(2, color, 0.72);
    const icon = this.add.graphics();
    icon.lineStyle(3, color, 1);
    if (kind === 'secure') {
      icon.strokeRoundedRect(-119, -14, 30, 28, 6);
      icon.strokeCircle(-104, -14, 10);
      icon.fillStyle(color, 1);
      icon.fillCircle(-104, 0, 3);
    } else {
      icon.strokeRoundedRect(-120, -15, 32, 30, 4);
      icon.lineBetween(-120, -5, -88, -5);
      icon.lineBetween(-112, -20, -112, -11);
      icon.lineBetween(-96, -20, -96, -11);
      icon.fillStyle(color, 1);
      icon.fillCircle(-105, 5, 3);
    }
    const text = this.add
      .text(18, 0, label, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        letterSpacing: 0.5,
      })
      .setOrigin(0.5);
    badge.add([bg, icon, text]);
    this.content?.add(badge);
  }

  private renderWardrobe(): void {
    const title = this.add
      .text(GAME_WIDTH / 2, 18, 'ELIGE COMO JUEGA DADDY POLLO', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '25px',
        color: COLORS_HEX.yellow,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, 55, 'Dos estilos inmediatos • Dos se conquistan jugando', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '16px',
        color: '#cfe0ff',
      })
      .setOrigin(0.5);
    this.content?.add([title, subtitle]);

    const skins = OUTFITS.filter((outfit) => outfit.id !== 'clasico');
    skins.forEach((outfit, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 190 + column * 340;
      const y = 290 + row * 440;
      this.addOutfitCard(x, y, outfit);
    });
  }

  private addOutfitCard(x: number, y: number, outfit: (typeof OUTFITS)[number]): void {
    const activeMember = hasActiveMembership(this.membership);
    const worldUnlocked = isOutfitAvailable(
      outfit.unlockWorld,
      storage.getMaxWorldUnlocked(),
    );
    const unlocked = activeMember && worldUnlocked;
    const selected = storage.getSelectedOutfit() === outfit.id;
    const card = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 300, 390, selected ? 0x123f74 : 0x07152e, 0.98)
      .setStrokeStyle(4, selected ? COLORS.yellow : unlocked ? COLORS.neon : 0x52617c, 1)
      .setInteractive({ useHandCursor: unlocked });
    const portrait = this.createAnimatedCharacterRig(
      0,
      -48,
      outfit.textureKey,
      230,
      unlocked ? 1 : 0.34,
      OUTFITS.indexOf(outfit) * 190,
    );
    const name = this.add
      .text(0, 105, outfit.name.toUpperCase(), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '20px',
        color: selected ? COLORS_HEX.yellow : '#ffffff',
        stroke: '#020817',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const lockLabel = !activeMember
      ? 'REQUIERE MEMBRESIA'
      : !worldUnlocked
        ? `BLOQUEADO • MUNDO ${outfit.unlockWorld}`
        : selected
          ? 'EQUIPADO'
          : outfit.tagline.toUpperCase();
    const state = this.add
      .text(0, 145, lockLabel, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '13px',
        color: selected ? COLORS_HEX.yellow : unlocked ? COLORS_HEX.neon : '#9aa8c0',
      })
      .setOrigin(0.5);
    const lock = this.add
      .text(0, -50, unlocked ? '' : '🔒', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '54px',
      })
      .setOrigin(0.5);
    card.add([bg, portrait.root, name, state, lock]);
    bg.on('pointerup', () => {
      if (!unlocked) {
        this.showToast(
          activeMember
            ? `Llega al Mundo ${outfit.unlockWorld} para desbloquearla.`
            : 'Activa una membresia para entrar al vestidor.',
          false,
        );
        return;
      }
      storage.setSelectedOutfit(outfit.id as OutfitId);
      this.membership.selectedOutfit = outfit.id;
      storage.setMembership(this.membership);
      this.registry.set(REGISTRY.membership, this.membership);
      audioManager.play('power');
      this.showToast(`${outfit.name} equipada`, true);
      this.renderTab();
    });
    this.content?.add(card);
  }

  private renderArsenal(): void {
    const title = this.add
      .text(GAME_WIDTH / 2, 18, 'ARSENAL EXCLUSIVO DE MEMBRESIA', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '25px',
        color: COLORS_HEX.yellow,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, 50, 'Mira todo lo que ganas • Elige tu arma VIP', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '15px',
        color: '#cfe0ff',
      })
      .setOrigin(0.5);
    this.content?.add([title, subtitle]);

    const membershipUnlocked = hasActiveMembership(this.membership);
    const weapons = Object.values(PREMIUM_WEAPONS);
    const weaponImages: Record<PremiumWeaponId, string> = {
      'plasma-neon': 'vip-tridente-plasma',
      'misil-sabor': 'vip-misil-sabor',
      'rayo-poseidon': 'vip-rayo-poseidon',
    };
    weapons.forEach((weapon, index) => {
      const x = 128 + index * 232;
      const selected = membershipUnlocked && storage.getSelectedWeapon() === weapon.id;
      const card = this.add.container(x, 205);
      const bg = this.add
        .rectangle(0, 0, 210, 260, selected ? 0x123f74 : 0x07152e, 0.98)
        .setStrokeStyle(4, selected ? COLORS.yellow : weapon.color, 1)
        .setInteractive({ useHandCursor: membershipUnlocked });
      const imageFrame = this.add
        .rectangle(0, -44, 184, 142, 0x020817, 0.72)
        .setStrokeStyle(2, weapon.color, 0.52);
      const weaponGlow = this.add
        .ellipse(0, -42, 150, 72, weapon.color, membershipUnlocked ? 0.18 : 0.08)
        .setBlendMode(Phaser.BlendModes.ADD);
      const image = this.add
        .image(0, -44, weaponImages[weapon.id])
        .setDisplaySize(174, 132)
        .setAlpha(membershipUnlocked ? 1 : 0.34);
      const name = this.add
        .text(0, 47, weapon.name, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '17px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 180 },
        })
        .setOrigin(0.5);
      const duration = this.add
        .text(0, 91, '15 SEGUNDOS', {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '13px',
          color: weapon.colorHex,
        })
        .setOrigin(0.5);
      const state = this.add
        .text(
          0,
          115,
          selected
            ? 'SELECCIONADA'
            : membershipUnlocked
              ? 'TOCA PARA ELEGIR'
              : 'REQUIERE MEMBRESIA',
          {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '10px',
          color: selected ? COLORS_HEX.yellow : membershipUnlocked ? COLORS_HEX.neon : '#9aa8c0',
          },
        )
        .setOrigin(0.5);
      card.add([bg, imageFrame, weaponGlow, image, name, duration, state]);
      this.animateWeaponPreview(image, weaponGlow, weapon.id, index);
      this.addRewardLock(card, !membershipUnlocked, 0, -44, 184, 142);
      bg.on('pointerup', () => {
        if (!membershipUnlocked) {
          this.showToast('Activa una membresia para usar el arsenal.', false);
          return;
        }
        storage.setSelectedWeapon(weapon.id as PremiumWeaponId);
        this.membership.selectedWeapon = weapon.id;
        storage.setMembership(this.membership);
        this.registry.set(REGISTRY.membership, this.membership);
        audioManager.play('power');
        this.renderTab();
      });
      this.content?.add(card);
    });

    this.addPlaneRewardCard(membershipUnlocked);

    const powerTitle = this.add
      .text(
        GAME_WIDTH / 2,
        590,
        'PODERES DADDY ELITE • UNO POR MUNDO',
        {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '19px',
          color: COLORS_HEX.yellow,
          align: 'center',
        },
      )
      .setOrigin(0.5);
    this.content?.add(powerTitle);

    const eliteUnlocked = isEliteMembership(this.membership);
    const powers = [
      {
        name: 'RAYOS DEL CIELO',
        texture: 'poder-rayos-cielo',
        color: 0x63e8ff,
        colorHex: '#9ffcff',
      },
      {
        name: 'FUEGO ARRASADOR',
        texture: 'poder-fuego-arrasador',
        color: 0xff5428,
        colorHex: '#ff8c3a',
      },
      {
        name: 'TERREMOTO DADDY',
        texture: 'poder-terremoto-daddy',
        color: 0xffd21e,
        colorHex: '#ffd21e',
      },
    ];
    powers.forEach((power, index) => {
      this.addPowerRewardCard(128 + index * 232, 735, power, eliteUnlocked);
    });

    const eliteNote = this.add
      .text(GAME_WIDTH / 2, 893, 'Carga el mando peleando y desata un poder al llegar al 100%.', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: eliteUnlocked ? '#ffffff' : '#9aa8c0',
        align: 'center',
        wordWrap: { width: 620, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.content?.add(eliteNote);
  }

  private addPlaneRewardCard(unlocked: boolean): void {
    const card = this.add.container(GAME_WIDTH / 2, 456);
    const bg = this.add
      .rectangle(0, 0, 660, 172, 0x07152e, 0.98)
      .setStrokeStyle(4, 0x43d9ff, 1);
    const imageFrame = this.add
      .rectangle(-194, 0, 244, 148, 0x020817, 0.7)
      .setStrokeStyle(2, 0x43d9ff, 0.6);
    const engineGlow = this.add
      .ellipse(-204, 18, 178, 62, 0x43d9ff, unlocked ? 0.2 : 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    const image = this.add
      .image(-194, 0, 'avion-daddy')
      .setDisplaySize(232, 140)
      .setAlpha(unlocked ? 1 : 0.34);
    const heading = this.add
      .text(92, -49, 'AVION DADDY', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '25px',
        color: '#43d9ff',
        stroke: '#020718',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const duration = this.add
      .text(92, -8, '10 SEGUNDOS POR MUNDO', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: COLORS_HEX.yellow,
      })
      .setOrigin(0.5);
    const description = this.add
      .text(92, 31, 'Ataque aereo automatico con doble cañon.', {
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 340, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const state = this.add
      .text(92, 64, unlocked ? 'INCLUIDO EN TU PLAN' : 'REQUIERE MEMBRESIA', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '11px',
        color: unlocked ? COLORS_HEX.neon : '#9aa8c0',
      })
      .setOrigin(0.5);
    card.add([bg, imageFrame, engineGlow, image, heading, duration, description, state]);
    this.animatePlanePreview(image, engineGlow);
    this.addRewardLock(card, !unlocked, -194, 0, 244, 148);
    bg.setInteractive({ useHandCursor: !unlocked });
    bg.on('pointerup', () => {
      if (!unlocked) this.showToast('Activa una membresia para desbloquear el Avion Daddy.', false);
    });
    this.content?.add(card);
  }

  private addPowerRewardCard(
    x: number,
    y: number,
    power: { name: string; texture: string; color: number; colorHex: string },
    unlocked: boolean,
  ): void {
    const card = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 210, 250, 0x07152e, 0.98)
      .setStrokeStyle(4, power.color, 1)
      .setInteractive({ useHandCursor: !unlocked });
    const aura = this.add
      .circle(0, -45, 70, power.color, unlocked ? 0.18 : 0.07)
      .setBlendMode(Phaser.BlendModes.ADD);
    const image = this.add
      .image(0, -45, power.texture)
      .setDisplaySize(188, 142)
      .setAlpha(unlocked ? 1 : 0.32);
    const shade = this.add.rectangle(0, 12, 188, 28, 0x020817, 0.78);
    const name = this.add
      .text(0, 43, power.name, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: power.colorHex,
        align: 'center',
        wordWrap: { width: 184, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const state = this.add
      .text(0, 98, unlocked ? 'PODER DESBLOQUEADO' : 'SOLO DADDY ELITE', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '10px',
        color: unlocked ? COLORS_HEX.neon : '#9aa8c0',
      })
      .setOrigin(0.5);
    card.add([bg, aura, image, shade, name, state]);
    this.animatePowerPreview(image, aura, power.texture);
    this.addRewardLock(card, !unlocked, 0, -45, 188, 142);
    bg.on('pointerup', () => {
      if (!unlocked) this.showToast('Este poder se desbloquea con Daddy Elite de $149.', false);
    });
    this.content?.add(card);
  }

  /**
   * Builds a lightweight four-part rig from the existing transparent outfit.
   * The overlapping crops keep the original artwork intact while letting the
   * head, crossed hands and each foot move independently.
   */
  private createAnimatedCharacterRig(
    x: number,
    y: number,
    textureKey: string,
    displaySize: number,
    alpha: number,
    phase: number,
  ): AnimatedCharacterRig {
    const frame = this.textures.getFrame(textureKey);
    const sourceWidth = frame?.realWidth ?? 1;
    const sourceHeight = frame?.realHeight ?? 1;
    const root = this.add.container(x, y);

    const makeLayer = (
      cropX: number,
      cropY: number,
      cropWidth: number,
      cropHeight: number,
      pivotX: number,
      pivotY: number,
    ): Phaser.GameObjects.Container => {
      const pivot = this.add.container(pivotX, pivotY);
      const image = this.add
        .image(-pivotX, -pivotY, textureKey)
        .setDisplaySize(displaySize, displaySize)
        .setAlpha(alpha)
        .setCrop(cropX, cropY, cropWidth, cropHeight);
      pivot.add(image);
      return pivot;
    };

    const headCut = Math.round(sourceHeight * 0.46);
    const handsTop = Math.round(sourceHeight * 0.38);
    const handsBottom = Math.round(sourceHeight * 0.76);
    const feetTop = Math.round(sourceHeight * 0.7);
    const halfWidth = Math.ceil(sourceWidth / 2);
    const headPivotY = -displaySize * 0.095;
    const handsPivotY = displaySize * 0.075;
    const feetPivotY = displaySize * 0.31;

    const head = makeLayer(0, 0, sourceWidth, headCut, 0, headPivotY);
    const hands = makeLayer(
      0,
      handsTop,
      sourceWidth,
      handsBottom - handsTop,
      0,
      handsPivotY,
    );
    const leftFoot = makeLayer(
      0,
      feetTop,
      halfWidth,
      sourceHeight - feetTop,
      -displaySize * 0.13,
      feetPivotY,
    );
    const rightFoot = makeLayer(
      halfWidth,
      feetTop,
      sourceWidth - halfWidth,
      sourceHeight - feetTop,
      displaySize * 0.13,
      feetPivotY,
    );
    root.add([leftFoot, rightFoot, hands, head]);

    const motionScale = displaySize / 230;
    this.tweens.add({
      targets: root,
      y: { from: y + 1.5 * motionScale, to: y - 2.5 * motionScale },
      scaleY: { from: 0.994, to: 1.008 },
      duration: 1550,
      delay: phase,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: head,
      angle: { from: -1.8, to: 2.1 },
      x: { from: -0.8 * motionScale, to: 0.8 * motionScale },
      y: {
        from: headPivotY + 0.8 * motionScale,
        to: headPivotY - 1.2 * motionScale,
      },
      duration: 1950,
      delay: phase + 90,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: hands,
      angle: { from: -0.7, to: 0.8 },
      y: {
        from: handsPivotY + 1.4 * motionScale,
        to: handsPivotY - 1.2 * motionScale,
      },
      scaleY: { from: 0.99, to: 1.012 },
      duration: 1280,
      delay: phase + 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: leftFoot,
      angle: { from: -1.2, to: 1.5 },
      y: {
        from: feetPivotY + 0.8 * motionScale,
        to: feetPivotY - 1.1 * motionScale,
      },
      duration: 1120,
      delay: phase + 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: rightFoot,
      angle: { from: 1.4, to: -1.1 },
      y: {
        from: feetPivotY - 0.8 * motionScale,
        to: feetPivotY + 1.1 * motionScale,
      },
      duration: 1120,
      delay: phase + 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    return { root, head, hands, leftFoot, rightFoot };
  }

  private animateWeaponPreview(
    image: Phaser.GameObjects.Image,
    glow: Phaser.GameObjects.Ellipse,
    weaponId: PremiumWeaponId,
    index: number,
  ): void {
    const baseScaleX = image.scaleX;
    const baseScaleY = image.scaleY;
    const isMissile = weaponId === 'misil-sabor';
    const isRay = weaponId === 'rayo-poseidon';
    this.tweens.add({
      targets: image,
      x: { from: isMissile ? -3 : -1, to: isMissile ? 3 : 1 },
      y: { from: -47, to: -41 },
      angle: { from: isRay ? -2.2 : -1.2, to: isRay ? 2.2 : 1.2 },
      scaleX: { from: baseScaleX * 0.985, to: baseScaleX * 1.025 },
      scaleY: { from: baseScaleY * 0.985, to: baseScaleY * 1.025 },
      duration: isMissile ? 1180 : isRay ? 760 : 980,
      delay: index * 170,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.34 },
      scaleX: { from: 0.86, to: 1.08 },
      scaleY: { from: 0.82, to: 1.05 },
      duration: 720 + index * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private animatePlanePreview(
    image: Phaser.GameObjects.Image,
    glow: Phaser.GameObjects.Ellipse,
  ): void {
    const baseScaleX = image.scaleX;
    const baseScaleY = image.scaleY;
    this.tweens.add({
      targets: image,
      x: { from: -200, to: -188 },
      y: { from: 3, to: -4 },
      angle: { from: -1.8, to: 1.8 },
      scaleX: { from: baseScaleX * 0.99, to: baseScaleX * 1.02 },
      scaleY: { from: baseScaleY * 0.99, to: baseScaleY * 1.02 },
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: glow,
      x: { from: -207, to: -197 },
      alpha: { from: 0.11, to: 0.32 },
      scaleX: { from: 0.78, to: 1.12 },
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private animatePowerPreview(
    image: Phaser.GameObjects.Image,
    aura: Phaser.GameObjects.Arc,
    textureKey: string,
  ): void {
    const baseScaleX = image.scaleX;
    const baseScaleY = image.scaleY;
    const isLightning = textureKey === 'poder-rayos-cielo';
    const isFire = textureKey === 'poder-fuego-arrasador';
    this.tweens.add({
      targets: image,
      x: { from: isLightning ? -2.5 : -1, to: isLightning ? 2.5 : 1 },
      y: { from: -49, to: isFire ? -40 : -42 },
      angle: {
        from: isLightning ? -2.4 : -1.3,
        to: isLightning ? 2.4 : 1.3,
      },
      scaleX: { from: baseScaleX * 0.97, to: baseScaleX * (isFire ? 1.07 : 1.045) },
      scaleY: { from: baseScaleY * 0.97, to: baseScaleY * (isFire ? 1.07 : 1.045) },
      duration: isLightning ? 430 : isFire ? 720 : 560,
      yoyo: true,
      repeat: -1,
      ease: isLightning ? 'Sine.inOut' : 'Quad.inOut',
    });
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.08, to: 0.34 },
      scale: { from: 0.78, to: 1.18 },
      duration: isLightning ? 360 : isFire ? 680 : 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private addRewardLock(
    card: Phaser.GameObjects.Container,
    locked: boolean,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (!locked) return;
    const overlay = this.add
      .rectangle(x, y, width, height, 0x020817, 0.52)
      .setStrokeStyle(2, 0xffffff, 0.2);
    const lockHalo = this.add
      .circle(x, y, 38, 0x020817, 0.82)
      .setStrokeStyle(3, COLORS.yellow, 0.85);
    const lock = this.add
      .text(x, y - 2, '🔒', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
      })
      .setOrigin(0.5);
    card.add([overlay, lockHalo, lock]);
    this.tweens.add({
      targets: lockHalo,
      alpha: { from: 0.7, to: 1 },
      scale: { from: 0.94, to: 1.06 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private makeAction(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onPress: () => void,
    fontSize: number,
  ): Phaser.GameObjects.Container {
    const wrapper = this.add.container(x, y);
    const glow = this.add
      .rectangle(0, 4, width + 8, height + 8, color, 0.18)
      .setStrokeStyle(4, color, 0.3);
    const button = this.add
      .rectangle(0, 0, width, height, color, 0.96)
      .setStrokeStyle(3, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        stroke: '#06143a',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    wrapper.add([glow, button, text]);
    button.on('pointerover', () => wrapper.setScale(1.025));
    button.on('pointerout', () => wrapper.setScale(1));
    button.on('pointerdown', () => wrapper.setScale(0.97));
    button.on('pointerup', () => {
      wrapper.setScale(1.025);
      audioManager.unlock();
      audioManager.play('click');
      onPress();
    });
    return wrapper;
  }

  private async refreshMembership(): Promise<void> {
    const phone = storage.getPlayerPhone();
    if (!phone) {
      this.updateStatusLabel();
      return;
    }
    const serverMembership = await api.getMembershipStatus(phone);
    const membership = import.meta.env.DEV
      ? withLocalDevelopmentAccess(this.membership)
      : serverMembership;
    membership.selectedOutfit = storage.getSelectedOutfit();
    membership.selectedWeapon = storage.getSelectedWeapon();
    this.membership = membership;
    storage.setMembership(membership);
    this.registry.set(REGISTRY.membership, membership);
    this.updateStatusLabel();
    this.renderTab();
  }

  private updateStatusLabel(): void {
    if (!this.statusText) return;
    if (hasActiveMembership(this.membership)) {
      const plan = MEMBERSHIP_PLANS[this.membership.planId];
      this.statusText
        .setText(`● ${plan.name} ACTIVA`)
        .setColor(COLORS_HEX.neon);
    } else {
      this.statusText
        .setText('CONOCE LOS PLANES Y ELIGE TU PODER')
        .setColor('#9fdcff');
    }
  }

  private async startCheckout(planId: MembershipPlanId): Promise<void> {
    if (this.registrationOpen) {
      return;
    }
    this.registrationOpen = true;
    this.input.enabled = false;
    audioManager.unlock();
    const config = this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined;
    const branches = config?.branches ?? [];
    const rememberedPhone = storage.getPlayerPhone();

    try {
      const rememberedPlayer = rememberedPhone
        ? await api.lookupPlayer(rememberedPhone)
        : null;
      const registration = await showRegistrationForm(
        branches,
        {
          name: rememberedPlayer?.name
            ?? (this.registry.get(REGISTRY.playerName) as string | undefined)
            ?? '',
          avatar: rememberedPlayer?.avatar ?? storage.getNickname(),
          phone: rememberedPhone,
          branch: storage.getBranch() ?? branches[0]?.id ?? '',
        },
        {
          title: `ACTIVA ${MEMBERSHIP_PLANS[planId].name}`,
          subtitle: 'Crea tu identidad VIP antes de continuar al pago',
          submitLabel: 'CONTINUAR AL PAGO',
          hint: 'Tus beneficios quedarán vinculados exclusivamente a este teléfono.',
        },
      );
      if (!registration || !this.scene.isActive()) return;

      const phone = registration.phone.replace(/[^\d+]/gu, '');
      storage.setNickname(registration.avatar);
      storage.setBranch(registration.branch);
      storage.setPlayerPhone(phone);
      this.registry.set(REGISTRY.playerName, registration.name);
      this.registry.set(REGISTRY.playerPhone, phone);
      this.registry.set(REGISTRY.nickname, registration.avatar);
      this.registry.set(REGISTRY.selectedBranch, registration.branch);

      this.showToast('Preparando pago seguro...', true);
      const result = await api.createMembershipCheckout(planId, {
        name: registration.name,
        avatar: registration.avatar,
        phone,
      });
      sessionStorage.setItem('dgc.pendingMembershipPlan', planId);
      sessionStorage.setItem('dgc.pendingMembershipProduct', result.productId);
      window.location.assign(result.url);
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : 'No fue posible abrir el pago seguro.',
        false,
      );
    } finally {
      this.registrationOpen = false;
      if (this.scene.isActive()) {
        this.input.enabled = true;
        this.scale.refresh();
      }
    }
  }

  private activateDemo(planId: MembershipPlanId): void {
    this.membership = {
      planId,
      status: 'active',
      selectedOutfit: storage.getSelectedOutfit(),
      selectedWeapon: storage.getSelectedWeapon(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      monthlyBenefit: planId === 'daddy-elite'
        ? {
          available: true,
          label: 'Papas con pollo chico + refresco de 325 ml',
        }
        : null,
    };
    storage.setMembership(this.membership);
    this.registry.set(REGISTRY.membership, this.membership);
    this.updateStatusLabel();
    this.showToast(`${MEMBERSHIP_PLANS[planId].name} activada en demo`, true);
    this.renderTab();
  }

  private showToast(message: string, success: boolean): void {
    this.toast?.destroy(true);
    const toast = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 84).setDepth(100);
    const bg = this.add
      .rectangle(0, 0, 620, 68, success ? 0x0c6b50 : 0x801f2a, 0.97)
      .setStrokeStyle(3, success ? COLORS.neon : COLORS.red, 1);
    const text = this.add
      .text(0, 0, message, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 580, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    toast.add([bg, text]);
    toast.setAlpha(0).setScale(0.92);
    this.toast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      y: GAME_HEIGHT - 105,
      duration: 220,
      ease: 'Back.out',
      onComplete: () => {
        this.time.delayedCall(2600, () => {
          if (!toast.active) return;
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: GAME_HEIGHT - 76,
            duration: 220,
            onComplete: () => toast.destroy(true),
          });
        });
      },
    });
  }
}
