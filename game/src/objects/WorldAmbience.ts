import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants.js';
import type { WorldDefinition } from '../config/worlds.js';

const SOFT_GLOW_TEXTURE = 'world-ambience-soft-glow';
const SOFT_BEAM_TEXTURE = 'world-ambience-soft-beam';

/**
 * Animates the original world artwork itself and adds restrained atmospheric
 * lighting. No foreign illustrated objects are placed over the paintings.
 */
export class WorldAmbience {
  private readonly scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private animatedTargets: object[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureSoftTextures();
  }

  activate(world: WorldDefinition): void {
    this.clear();

    switch (world.id) {
      case 1:
        this.createBahiaNeon(world.backgroundKey);
        break;
      case 2:
        this.createPuertoCorsario(world.backgroundKey);
        break;
      case 3:
        this.createTemploPoseidon(world.backgroundKey);
        break;
      case 4:
        this.createPantanoToxico(world.backgroundKey);
        break;
      case 5:
        this.createFortalezaOmega(world.backgroundKey);
        break;
      case 6:
        this.createFronteraElemental(world.backgroundKey);
        break;
      case 7:
        this.createBaseApocalipsis(world.backgroundKey);
        break;
      case 8:
        this.createInvasionAlien(world.backgroundKey);
        break;
      default:
        this.createGlints([world.color, 0xffffff], 180);
    }
  }

  clear(): void {
    this.animatedTargets.forEach((target) => this.scene.tweens.killTweensOf(target));
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.animatedTargets = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private animate(target: object): void {
    this.animatedTargets.push(target);
  }

  private ensureSoftTextures(): void {
    if (!this.scene.textures.exists(SOFT_GLOW_TEXTURE)) {
      const texture = this.scene.textures.createCanvas(SOFT_GLOW_TEXTURE, 128, 128);
      if (texture) {
        const context = texture.getContext();
        const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        glow.addColorStop(0, 'rgba(255,255,255,1)');
        glow.addColorStop(0.24, 'rgba(255,255,255,0.62)');
        glow.addColorStop(0.62, 'rgba(255,255,255,0.14)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, 128, 128);
        texture.refresh();
      }
    }

    if (!this.scene.textures.exists(SOFT_BEAM_TEXTURE)) {
      const texture = this.scene.textures.createCanvas(SOFT_BEAM_TEXTURE, 96, 512);
      if (texture) {
        const context = texture.getContext();
        const horizontal = context.createLinearGradient(0, 0, 96, 0);
        horizontal.addColorStop(0, 'rgba(255,255,255,0)');
        horizontal.addColorStop(0.38, 'rgba(255,255,255,0.24)');
        horizontal.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        horizontal.addColorStop(0.62, 'rgba(255,255,255,0.24)');
        horizontal.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = horizontal;
        context.fillRect(0, 0, 96, 512);
        context.globalCompositeOperation = 'destination-in';
        const vertical = context.createLinearGradient(0, 0, 0, 512);
        vertical.addColorStop(0, 'rgba(255,255,255,0)');
        vertical.addColorStop(0.18, 'rgba(255,255,255,0.72)');
        vertical.addColorStop(0.72, 'rgba(255,255,255,1)');
        vertical.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = vertical;
        context.fillRect(0, 0, 96, 512);
        context.globalCompositeOperation = 'source-over';
        texture.refresh();
      }
    }
  }

  private createBahiaNeon(textureKey: string): void {
    // The water is made from animated slices of the original painting, so its
    // colors, reflections and perspective remain completely coherent.
    this.createImageFlow(textureKey, 500, 920, 16, 5.5, 1_450, 0.48);
    this.createSunReflection();
    this.createBlinkingLights([
      [47, 490], [80, 524], [118, 553], [466, 492], [432, 532], [492, 570],
    ], [0x43d9ff, 0xffc45e], 18);
    this.createGlints([0x43d9ff, 0x21e6c1, 0xffd28a], 260);
  }

  private createPuertoCorsario(textureKey: string): void {
    this.createImageFlow(textureKey, 485, 850, 15, 8, 1_180, 0.52);
    this.createImageFlow(textureKey, 60, 430, 8, 2.4, 3_200, 0.2);
    this.createRain();
    this.createLightning(0xb9eaff, 0.23, 3_600);
    this.createBlinkingLights([
      [72, 346], [111, 394], [138, 472], [414, 331], [462, 386], [489, 468],
      [91, 518], [449, 533],
    ], [0xff513e, 0xffb347], 21);
  }

  private createTemploPoseidon(textureKey: string): void {
    this.createImageFlow(textureKey, 0, 500, 12, 3.2, 2_350, 0.27);
    this.createImageFlow(textureKey, 500, 900, 12, 4, 1_900, 0.34);
    const bubbles = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: 18, max: GAME_WIDTH - 18 },
      y: { min: 500, max: GAME_HEIGHT + 25 },
      lifespan: { min: 4_800, max: 8_200 },
      speedY: { min: -58, max: -22 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.055, end: 0.012 },
      alpha: { start: 0.42, end: 0 },
      tint: [0xffffff, 0x7df6ff, 0x43d9ff],
      frequency: 165,
      blendMode: 'ADD',
    }).setDepth(1.05));
    void bubbles;
    this.createCausticBeams();
    this.createBlinkingLights([
      [222, 532], [270, 475], [315, 529], [165, 590], [374, 594],
    ], [0x42e8ff, 0xffd46b], 16);
  }

  private createPantanoToxico(textureKey: string): void {
    this.createImageFlow(textureKey, 505, 915, 14, 5.2, 1_700, 0.44);
    const spores = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: 24, max: GAME_WIDTH - 24 },
      y: { min: 540, max: GAME_HEIGHT - 90 },
      lifespan: { min: 2_800, max: 5_100 },
      speedY: { min: -34, max: -10 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.055, end: 0 },
      alpha: { start: 0.46, end: 0 },
      tint: [0x9cff57, 0xd5ff72, 0xb649ff],
      frequency: 145,
      blendMode: 'ADD',
    }).setDepth(1.08));
    void spores;
    this.createSoftMist(0x7dff38, 655);
    this.createBlinkingLights([
      [91, 389], [153, 465], [406, 386], [455, 478], [270, 606],
    ], [0xb649ff, 0x9cff57], 20);
  }

  private createFortalezaOmega(textureKey: string): void {
    this.createImageFlow(textureKey, 0, 390, 9, 2.7, 3_100, 0.2);
    this.createEnergyBeam(270, 285, 0xd85cff, 64, 610, 0.19);
    this.createPulseGlow(270, 370, 0xd85cff, 150, 60, 0.28, 1_700);
    this.createGlints([0xd85cff, 0x7c4dff, 0xffffff], 225);
    this.createBlinkingLights([
      [201, 423], [339, 423], [158, 566], [383, 566], [221, 646], [319, 646],
    ], [0xd85cff, 0x54b8ff], 18);
  }

  private createFronteraElemental(textureKey: string): void {
    this.createImageFlow(textureKey, 0, 585, 12, 3.4, 2_650, 0.18);
    const embers = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: 12, max: GAME_WIDTH / 2 - 10 },
      y: { min: 340, max: GAME_HEIGHT - 100 },
      lifespan: { min: 1_500, max: 3_300 },
      speedY: { min: -90, max: -32 },
      speedX: { min: -16, max: 22 },
      scale: { start: 0.055, end: 0 },
      alpha: { start: 0.82, end: 0 },
      tint: [0xff4a20, 0xffb21f, 0xffef8a],
      frequency: 105,
      blendMode: 'ADD',
    }).setDepth(1.08));
    const snow = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: GAME_WIDTH / 2 + 10, max: GAME_WIDTH - 12 },
      y: { min: 120, max: 560 },
      lifespan: { min: 3_000, max: 5_500 },
      speedY: { min: 28, max: 72 },
      speedX: { min: -18, max: 12 },
      scale: { start: 0.045, end: 0.012 },
      alpha: { start: 0.67, end: 0 },
      tint: [0xffffff, 0x7defff, 0x43a9ff],
      frequency: 120,
      blendMode: 'ADD',
    }).setDepth(1.08));
    void embers;
    void snow;
    this.createLightning(0xff5a31, 0.08, 4_300, 0, GAME_WIDTH / 2);
    this.createLightning(0x52dfff, 0.09, 3_700, GAME_WIDTH / 2, GAME_WIDTH / 2);
  }

  private createBaseApocalipsis(textureKey: string): void {
    this.createImageFlow(textureKey, 0, 500, 10, 2.8, 3_250, 0.19);
    const ash = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: -20, max: 430 },
      lifespan: { min: 3_400, max: 6_200 },
      speedY: { min: 32, max: 75 },
      speedX: { min: -22, max: 16 },
      scale: { start: 0.032, end: 0.008 },
      alpha: { start: 0.34, end: 0 },
      tint: [0xffb347, 0xaab9d9, 0x66728c],
      frequency: 115,
    }).setDepth(1));
    void ash;
    this.createSearchlight(122, -16, 13, 0x7eaaff);
    this.createSearchlight(418, 16, -13, 0x7eaaff);
    this.createLightning(0x7aa8ff, 0.14, 4_800);
    this.createBlinkingLights([
      [73, 653], [466, 653], [154, 590], [386, 590], [270, 535],
    ], [0xff5a31, 0xffb347], 18);
  }

  private createInvasionAlien(textureKey: string): void {
    this.createImageFlow(textureKey, 0, 650, 13, 3, 3_000, 0.2);
    this.createEnergyBeam(270, 535, 0xcb69ff, 70, 770, 0.17);
    this.createPulseGlow(270, 722, 0x8fffff, 300, 78, 0.2, 2_100);
    this.createGlints([0xcb69ff, 0x43d9ff, 0xffffff], 210);
    this.createBlinkingLights([
      [112, 526], [428, 526], [172, 614], [368, 614], [270, 705],
    ], [0x43d9ff, 0xcb69ff], 18);
  }

  /**
   * Re-renders narrow crops from the loaded background and moves them by a
   * few pixels. This creates genuine refraction/current/cloud movement while
   * keeping the original artwork and perspective intact.
   */
  private createImageFlow(
    textureKey: string,
    startY: number,
    endY: number,
    slices: number,
    amplitude: number,
    duration: number,
    alpha: number,
  ): void {
    if (!this.scene.textures.exists(textureKey)) {
      return;
    }
    const source = this.scene.textures.get(textureKey).getSourceImage() as {
      width: number;
      height: number;
    };
    if (!source.width || !source.height) {
      return;
    }
    const safeStart = Phaser.Math.Clamp(startY, 0, GAME_HEIGHT - 1);
    const safeEnd = Phaser.Math.Clamp(endY, safeStart + 1, GAME_HEIGHT);
    const sourceStart = Math.floor((safeStart / GAME_HEIGHT) * source.height);
    const sourceEnd = Math.ceil((safeEnd / GAME_HEIGHT) * source.height);
    const sliceHeight = Math.ceil((sourceEnd - sourceStart) / slices);

    for (let index = 0; index < slices; index += 1) {
      const cropY = sourceStart + index * sliceHeight;
      const cropHeight = Math.min(sliceHeight + 2, source.height - cropY);
      if (cropHeight <= 0) break;
      const edgeFade = Math.min(1, (index + 1) / 3, (slices - index) / 3);
      const sliceAlpha = alpha * edgeFade;
      const slice = this.keep(this.scene.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, textureKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setCrop(0, cropY, source.width, cropHeight)
        .setAlpha(sliceAlpha * 0.78)
        .setDepth(0.72));
      const baseScaleX = slice.scaleX;
      this.animate(slice);
      this.scene.tweens.add({
        targets: slice,
        x: GAME_WIDTH / 2 + (index % 2 === 0 ? amplitude : -amplitude),
        scaleX: baseScaleX * (1.004 + (index % 3) * 0.0025),
        alpha: { from: sliceAlpha * 0.58, to: sliceAlpha },
        duration: duration + (index % 5) * 135,
        delay: index * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private createBlinkingLights(
    positions: Array<[number, number]>,
    colors: number[],
    size: number,
  ): void {
    positions.forEach(([x, y], index) => {
      const glow = this.keep(this.scene.add
        .image(x, y, SOFT_GLOW_TEXTURE)
        .setDisplaySize(size + (index % 3) * 4, size + (index % 3) * 4)
        .setTint(colors[index % colors.length])
        .setAlpha(0.14)
        .setDepth(1.2)
        .setBlendMode(Phaser.BlendModes.ADD));
      this.animate(glow);
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.06, to: 0.68 },
        scale: { from: 0.72, to: 1.32 },
        duration: 650 + (index % 4) * 245,
        delay: index * 160,
        yoyo: true,
        repeat: -1,
        repeatDelay: 250 + (index % 3) * 230,
        ease: 'Sine.inOut',
      });
    });
  }

  private createGlints(colors: number[], frequency: number): void {
    const glints = this.keep(this.scene.add.particles(0, 0, SOFT_GLOW_TEXTURE, {
      x: { min: 20, max: GAME_WIDTH - 20 },
      y: { min: 135, max: GAME_HEIGHT - 150 },
      lifespan: { min: 2_200, max: 4_500 },
      speedY: { min: -25, max: -7 },
      speedX: { min: -7, max: 7 },
      scale: { start: 0.038, end: 0 },
      alpha: { start: 0.42, end: 0 },
      tint: colors,
      frequency,
      blendMode: 'ADD',
    }).setDepth(1.02));
    void glints;
  }

  private createSunReflection(): void {
    for (let index = 0; index < 8; index += 1) {
      const reflection = this.keep(this.scene.add
        .image(270, 518 + index * 35, SOFT_GLOW_TEXTURE)
        .setDisplaySize(48 + index * 16, 8 + index * 0.8)
        .setTint(0xffd18a)
        .setAlpha(0.15)
        .setDepth(0.88)
        .setBlendMode(Phaser.BlendModes.ADD));
      this.animate(reflection);
      this.scene.tweens.add({
        targets: reflection,
        x: 270 + (index % 2 === 0 ? 8 : -8),
        scaleX: { from: 0.76, to: 1.18 },
        alpha: { from: 0.07, to: 0.34 },
        duration: 1_250 + index * 135,
        yoyo: true,
        repeat: -1,
        delay: index * 100,
        ease: 'Sine.inOut',
      });
    }
  }

  private createRain(): void {
    const rain = this.keep(this.scene.add.particles(0, 0, '__WHITE', {
      x: { min: -30, max: GAME_WIDTH + 30 },
      y: { min: -40, max: 280 },
      lifespan: { min: 700, max: 1_250 },
      speedY: { min: 430, max: 680 },
      speedX: { min: -105, max: -55 },
      scaleX: { start: 0.025, end: 0.012 },
      scaleY: { start: 0.7, end: 0.26 },
      alpha: { start: 0.38, end: 0 },
      tint: [0x9edfff, 0xd8f5ff],
      frequency: 42,
      blendMode: 'ADD',
    }).setDepth(1.35));
    void rain;
  }

  private createLightning(
    color: number,
    alpha: number,
    delay: number,
    x = 0,
    width = GAME_WIDTH,
  ): void {
    const flash = this.keep(this.scene.add
      .rectangle(x, 0, width, GAME_HEIGHT, color, 0)
      .setOrigin(0)
      .setDepth(1.3)
      .setBlendMode(Phaser.BlendModes.ADD));
    this.animate(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: alpha },
      duration: 75,
      hold: 45,
      yoyo: true,
      repeat: -1,
      repeatDelay: delay,
      ease: 'Cubic.out',
    });
  }

  private createSoftMist(color: number, y: number): void {
    for (let index = 0; index < 4; index += 1) {
      const mist = this.keep(this.scene.add
        .image(45 + index * 150, y + (index % 2) * 85, SOFT_GLOW_TEXTURE)
        .setDisplaySize(280, 68)
        .setTint(color)
        .setAlpha(0.04)
        .setDepth(0.84)
        .setBlendMode(Phaser.BlendModes.ADD));
      this.animate(mist);
      this.scene.tweens.add({
        targets: mist,
        x: mist.x + (index % 2 === 0 ? 70 : -70),
        scaleX: { from: 0.82, to: 1.24 },
        alpha: { from: 0.025, to: 0.09 },
        duration: 3_600 + index * 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private createCausticBeams(): void {
    for (let index = 0; index < 5; index += 1) {
      const beam = this.keep(this.scene.add
        .image(60 + index * 108, 130, SOFT_BEAM_TEXTURE)
        .setOrigin(0.5, 0)
        .setDisplaySize(74, 470)
        .setTint(0x8fffff)
        .setAlpha(0.045)
        .setAngle(-16 + index * 8)
        .setDepth(0.84)
        .setBlendMode(Phaser.BlendModes.ADD));
      this.animate(beam);
      this.scene.tweens.add({
        targets: beam,
        angle: beam.angle + (index % 2 === 0 ? 6 : -6),
        alpha: { from: 0.025, to: 0.09 },
        duration: 2_800 + index * 390,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private createEnergyBeam(
    x: number,
    y: number,
    color: number,
    width: number,
    height: number,
    alpha: number,
  ): void {
    const beam = this.keep(this.scene.add
      .image(x, y, SOFT_BEAM_TEXTURE)
      .setDisplaySize(width, height)
      .setTint(color)
      .setAlpha(alpha)
      .setDepth(0.92)
      .setBlendMode(Phaser.BlendModes.ADD));
    this.animate(beam);
    this.scene.tweens.add({
      targets: beam,
      scaleX: { from: 0.72, to: 1.28 },
      alpha: { from: alpha * 0.42, to: alpha },
      duration: 1_450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private createPulseGlow(
    x: number,
    y: number,
    color: number,
    width: number,
    height: number,
    alpha: number,
    duration: number,
  ): void {
    const glow = this.keep(this.scene.add
      .image(x, y, SOFT_GLOW_TEXTURE)
      .setDisplaySize(width, height)
      .setTint(color)
      .setAlpha(alpha * 0.45)
      .setDepth(0.94)
      .setBlendMode(Phaser.BlendModes.ADD));
    this.animate(glow);
    this.scene.tweens.add({
      targets: glow,
      scaleX: { from: 0.76, to: 1.25 },
      scaleY: { from: 0.82, to: 1.16 },
      alpha: { from: alpha * 0.32, to: alpha },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private createSearchlight(x: number, fromAngle: number, toAngle: number, color: number): void {
    const beam = this.keep(this.scene.add
      .image(x, 750, SOFT_BEAM_TEXTURE)
      .setOrigin(0.5, 1)
      .setDisplaySize(86, 650)
      .setTint(color)
      .setAlpha(0.055)
      .setAngle(fromAngle)
      .setDepth(0.92)
      .setBlendMode(Phaser.BlendModes.ADD));
    this.animate(beam);
    this.scene.tweens.add({
      targets: beam,
      angle: toAngle,
      alpha: { from: 0.025, to: 0.1 },
      duration: 3_700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }
}
