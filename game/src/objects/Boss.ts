import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import type { WorldDefinition } from '../config/worlds.js';

export interface BossUpdateResult {
  shouldAttack: boolean;
  phase: number;
}

export interface BossSpawnOptions {
  texture?: string;
  startX?: number;
  baseY?: number;
  direction?: -1 | 1;
  displayWidth?: number;
  displayHeight?: number;
  patrolMinX?: number;
  patrolMaxX?: number;
  healthMultiplier?: number;
}

type BossMotionProfile =
  | 'hover'
  | 'aquatic'
  | 'toxic'
  | 'energy'
  | 'aircraft'
  | 'carrier';

interface AnimatedPartRig {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/** Large animated final enemy shared by the campaign worlds. */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  public definition!: WorldDefinition;

  private health = 1;
  private maxHealth = 1;
  private baseY = 310;
  private baseScaleX = 1;
  private baseScaleY = 1;
  private direction: -1 | 1 = 1;
  private nextAttackAt = 0;
  private phaseOffset = 0;
  private spawnedAt = 0;
  private readonly entranceDuration = 1150;
  private readonly entranceStartY = -180;
  private patrolMinX?: number;
  private patrolMaxX?: number;
  private articulated = true;
  private motionProfile: BossMotionProfile = 'hover';
  private horizontalVelocity = 0;
  private flightLean = 0;
  private pathCenterX = GAME_WIDTH / 2;
  private attackMotionUntil = 0;
  private hitMotionUntil = 0;
  private readonly headLayer: Phaser.GameObjects.Image;
  private readonly leftArmLayer: Phaser.GameObjects.Image;
  private readonly rightArmLayer: Phaser.GameObjects.Image;
  private readonly leftLegLayer: Phaser.GameObjects.Image;
  private readonly rightLegLayer: Phaser.GameObjects.Image;
  private readonly animatedParts: Phaser.GameObjects.Image[];
  private readonly partRigs = new Map<Phaser.GameObjects.Image, AnimatedPartRig>();
  private readonly leftPropulsionGlow: Phaser.GameObjects.Ellipse;
  private readonly rightPropulsionGlow: Phaser.GameObjects.Ellipse;
  private propulsionEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'jefe-mundo-1');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.headLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.leftArmLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.rightArmLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.leftLegLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.rightLegLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.leftPropulsionGlow = scene.add
      .ellipse(x, y, 26, 64, 0xff8a2a, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(10)
      .setVisible(false);
    this.rightPropulsionGlow = scene.add
      .ellipse(x, y, 26, 64, 0xff8a2a, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(10)
      .setVisible(false);
    this.animatedParts = [
      this.leftLegLayer,
      this.rightLegLayer,
      this.leftArmLayer,
      this.rightArmLayer,
      this.headLayer,
    ];
    this.animatedParts.forEach((part, index) => {
      part.setVisible(false).setActive(false).setDepth(index < 2 ? 11.5 : 12);
    });
    this.setActive(false).setVisible(false);
  }

  get healthRatio(): number {
    return Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
  }

  getMuzzlePosition(patternIndex = 0): { x: number; y: number } {
    const facing = this.flipX ? -1 : 1;
    const alternatingSide = patternIndex % 2 === 0 ? 1 : -1;

    if (this.motionProfile === 'aircraft') {
      return {
        x: this.x + this.direction * this.displayWidth * 0.28,
        y: this.y + this.displayHeight * (0.12 + alternatingSide * 0.04),
      };
    }
    if (this.motionProfile === 'carrier') {
      return {
        x: this.x + alternatingSide * this.displayWidth * 0.2,
        y: this.y + this.displayHeight * 0.16,
      };
    }

    return {
      x: this.x + facing * alternatingSide * this.displayWidth * 0.27,
      y: this.y + this.displayHeight * (alternatingSide > 0 ? -0.04 : 0.035),
    };
  }

  spawn(
    definition: WorldDefinition,
    time: number,
    difficultyLevel: number,
    options: BossSpawnOptions = {},
  ): void {
    this.definition = definition;
    const difficultyHealth = 0.82 + difficultyLevel * 0.036;
    this.maxHealth = Math.max(
      12,
      Math.round(definition.bossHealth * difficultyHealth * (options.healthMultiplier ?? 1)),
    );
    this.health = this.maxHealth;
    this.baseY = options.baseY ?? 325;
    // Alternate the entrance direction between worlds so bosses can cross the
    // arena in both directions.
    this.direction = options.direction ?? (definition.id % 2 === 0 ? -1 : 1);
    this.patrolMinX = options.patrolMinX;
    this.patrolMaxX = options.patrolMaxX;
    this.spawnedAt = time;
    this.pathCenterX = options.startX ?? GAME_WIDTH / 2;
    this.horizontalVelocity = 0;
    this.flightLean = 0;
    this.nextAttackAt =
      time + this.entranceDuration + Phaser.Math.Clamp(700 - difficultyLevel * 25, 350, 650);
    this.phaseOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.attackMotionUntil = 0;
    this.hitMotionUntil = 0;

    const texture = options.texture ?? definition.bossTexture;
    this.motionProfile = this.resolveMotionProfile(definition);
    this.articulated =
      this.motionProfile !== 'aircraft' &&
      this.motionProfile !== 'carrier';
    this.setTexture(texture);
    this.setDisplaySize(options.displayWidth ?? 330, options.displayHeight ?? 430);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.enableBody(true, options.startX ?? GAME_WIDTH / 2, this.entranceStartY, true, true);
    this.setActive(true).setVisible(true).setAlpha(1).setAngle(0).setDepth(11).clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(this.width * 0.58, this.height * 0.68);
    body.setVelocity(0, 0);
    if (this.articulated) {
      this.configureAnimatedParts(texture);
    } else {
      this.hideAnimatedParts();
    }
    this.configurePropulsion();
    this.syncAnimatedParts(time, 1, GAME_WIDTH / 2);
    this.syncPropulsion(time, 1);
  }

  updateBoss(
    time: number,
    difficultySpeedMultiplier: number,
    delta: number,
    targetX = GAME_WIDTH / 2,
  ): BossUpdateResult {
    if (!this.active) {
      return { shouldAttack: false, phase: 1 };
    }

    const phase = this.healthRatio > 0.66 ? 1 : this.healthRatio > 0.32 ? 2 : 3;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !body.enable) {
      return { shouldAttack: false, phase };
    }
    const frameSeconds = Phaser.Math.Clamp(delta, 0, 50) / 1000;
    const halfWidth = this.displayWidth * 0.5;
    const flightSeconds = Math.max(0, time - this.spawnedAt) / 1000;
    const hover = Math.sin(time * 0.0045 + this.phaseOffset);
    const secondaryHover = Math.sin(time * 0.0021 + this.phaseOffset * 0.7);
    const patrolSpeed = (68 + this.definition.id * 8 + phase * 12) * difficultySpeedMultiplier;
    let nextX = this.x;
    let settledY = this.baseY;
    let targetLean = 0;

    if (this.motionProfile === 'aircraft') {
      const amplitude = Math.max(260, GAME_WIDTH / 2 - halfWidth - 110);
      nextX = this.pathCenterX + Math.sin(flightSeconds * 0.58) * amplitude;
      settledY =
        this.baseY +
        Math.sin(flightSeconds * 1.22 + this.phaseOffset) * 38 +
        Math.cos(flightSeconds * 0.46) * 14;
      this.horizontalVelocity = Math.cos(flightSeconds * 0.58) * amplitude * 0.58;
      this.direction = this.horizontalVelocity >= 0 ? 1 : -1;
      targetLean = Phaser.Math.Clamp(this.horizontalVelocity / 62, -10, 10);
    } else if (this.motionProfile === 'carrier') {
      const amplitude = Math.max(220, GAME_WIDTH / 2 - halfWidth - 150);
      nextX = this.pathCenterX + Math.sin(flightSeconds * 0.34) * amplitude;
      settledY =
        this.baseY +
        Math.sin(flightSeconds * 0.68 + this.phaseOffset) * 24 +
        Math.cos(flightSeconds * 0.31) * 11;
      this.horizontalVelocity = Math.cos(flightSeconds * 0.34) * amplitude * 0.34;
      this.direction = this.horizontalVelocity >= 0 ? 1 : -1;
      targetLean = Phaser.Math.Clamp(this.horizontalVelocity / 85, -4.5, 4.5);
    } else {
      const patrolMin = this.patrolMinX ?? Math.max(halfWidth * 0.72, 120);
      const patrolMax = this.patrolMaxX ?? GAME_WIDTH - Math.max(halfWidth * 0.72, 120);
      if (this.x <= patrolMin + 2) {
        this.direction = 1;
      } else if (this.x >= patrolMax - 2) {
        this.direction = -1;
      }
      const profileSpeedFactor =
        this.motionProfile === 'aquatic'
          ? 0.82
          : this.motionProfile === 'energy'
            ? 1.08
            : this.motionProfile === 'toxic'
              ? 0.9
              : 1;
      const targetVelocity =
        patrolSpeed * profileSpeedFactor * this.direction;
      const acceleration =
        this.motionProfile === 'energy' ? 4.2 : this.motionProfile === 'aquatic' ? 3.2 : 5;
      const velocityBlend = 1 - Math.exp(-acceleration * frameSeconds);
      this.horizontalVelocity = Phaser.Math.Linear(
        this.horizontalVelocity,
        targetVelocity,
        velocityBlend,
      );
      nextX = Phaser.Math.Clamp(
        this.x + this.horizontalVelocity * frameSeconds,
        patrolMin,
        patrolMax,
      );
      targetLean = Phaser.Math.Clamp(
        this.horizontalVelocity / Math.max(18, patrolSpeed) * 5.5,
        -6,
        6,
      );

      switch (this.motionProfile) {
        case 'aquatic':
          settledY = this.baseY + hover * (18 + phase * 3) + secondaryHover * 9;
          targetLean += secondaryHover * 2.2;
          break;
        case 'toxic':
          settledY = this.baseY + hover * (11 + phase * 2) + Math.sin(time * 0.011) * 3;
          targetLean += hover * 1.8;
          break;
        case 'energy':
          settledY = this.baseY + hover * (16 + phase * 3) + secondaryHover * 7;
          targetLean += hover * 2.6;
          break;
        case 'hover':
          settledY = this.baseY + hover * (12 + phase * 3) + secondaryHover * 5;
          targetLean += hover * 2;
          break;
      }
    }

    const entranceProgress = Phaser.Math.Clamp(
      (time - this.spawnedAt) / this.entranceDuration,
      0,
      1,
    );
    const entranceEase = Phaser.Math.Easing.Cubic.Out(entranceProgress);
    const nextY = Phaser.Math.Linear(this.entranceStartY, settledY, entranceEase);
    body.reset(nextX, nextY);
    body.setVelocity(0, 0);
    this.setPosition(nextX, nextY);
    this.setFlipX(
      this.motionProfile === 'aircraft'
        ? this.direction > 0
        : this.direction < 0,
    );
    this.flightLean = Phaser.Math.Linear(this.flightLean, targetLean, 0.08);
    const attackPulse = time < this.attackMotionUntil
      ? Math.sin(
        Phaser.Math.Clamp(1 - (this.attackMotionUntil - time) / 460, 0, 1) * Math.PI,
      )
      : 0;
    this.angle = Phaser.Math.Linear(
      this.angle,
      this.flightLean + hover * 1.4 - attackPulse * this.direction * 2.5,
      0.08,
    );
    const breathing = Math.sin(time * 0.0062 + this.phaseOffset);
    const wingPulse =
      this.motionProfile === 'energy'
        ? Math.sin(time * 0.009 + this.phaseOffset) * 0.018
        : this.motionProfile === 'aircraft' || this.motionProfile === 'carrier'
          ? Math.abs(Math.sin(time * 0.004 + this.phaseOffset)) * 0.01
          : 0;
    this.setScale(
      this.baseScaleX *
      (1 + breathing * 0.012 + wingPulse + attackPulse * 0.026 + (phase - 1) * 0.012),
      this.baseScaleY *
      (1 - breathing * 0.009 - wingPulse * 0.35 - attackPulse * 0.018 + (phase - 1) * 0.012),
    );
    this.syncAnimatedParts(time, phase, targetX);
    this.syncPropulsion(time, phase);

    if (entranceProgress < 1 || time < this.nextAttackAt) {
      return { shouldAttack: false, phase };
    }
    // When wrapping around the arena, hold the ready attack until the boss is
    // visibly back on screen. This guarantees every scheduled volley is seen.
    if (this.x < 20 || this.x > GAME_WIDTH - 20) {
      return { shouldAttack: false, phase };
    }
    const enragedFactor = phase === 3 ? 0.63 : phase === 2 ? 0.8 : 1;
    const attackDelay =
      (this.definition.attackIntervalMs * enragedFactor) / difficultySpeedMultiplier;
    this.nextAttackAt = time + Phaser.Math.Clamp(attackDelay, 620, 2300);
    return { shouldAttack: true, phase };
  }

  playAttackMotion(time: number): void {
    this.attackMotionUntil = Math.max(this.attackMotionUntil, time + 460);
    this.horizontalVelocity -= this.direction * (
      this.motionProfile === 'aircraft' || this.motionProfile === 'carrier' ? 24 : 12
    );
    this.flightLean -= this.direction * 1.8;
  }

  hideAnimatedParts(): void {
    this.animatedParts.forEach((part) => part.setActive(false).setVisible(false));
    this.partRigs.clear();
    this.hidePropulsion();
  }

  private resolveMotionProfile(definition: WorldDefinition): BossMotionProfile {
    if (definition.bossPattern === 'atomic-aircraft') {
      return 'aircraft';
    }
    if (definition.bossPattern === 'alien-carrier') {
      return 'carrier';
    }
    if (definition.id === 3) {
      return 'aquatic';
    }
    if (definition.id === 4) {
      return 'toxic';
    }
    if (definition.id === 5 || definition.id === 6) {
      return 'energy';
    }
    return 'hover';
  }

  private configurePropulsion(): void {
    this.propulsionEmitter?.destroy();
    const aquatic = this.motionProfile === 'aquatic';
    const particleColor = aquatic ? 0x70efff : this.definition.color;
    const horizontalSpread =
      this.motionProfile === 'aircraft' || this.motionProfile === 'carrier'
        ? this.displayWidth * 0.3
        : this.displayWidth * 0.18;
    this.propulsionEmitter = this.scene.add
      .particles(0, 0, '__WHITE', {
        x: { min: -horizontalSpread, max: horizontalSpread },
        y: 0,
        lifespan: aquatic ? { min: 480, max: 850 } : { min: 240, max: 520 },
        speedX: aquatic ? { min: -22, max: 22 } : { min: -34, max: 34 },
        speedY: aquatic ? { min: -82, max: -38 } : { min: 92, max: 185 },
        scale: aquatic ? { start: 0.22, end: 0.04 } : { start: 0.28, end: 0 },
        alpha: { start: 0.82, end: 0 },
        rotate: { min: -18, max: 18 },
        tint: [particleColor, this.definition.color, 0xffffff],
        frequency: aquatic ? 82 : 34,
        quantity: 1,
        blendMode: 'ADD',
      })
      .setDepth(9.8);

    this.leftPropulsionGlow
      .setFillStyle(particleColor, aquatic ? 0.38 : 0.64)
      .setVisible(true);
    this.rightPropulsionGlow
      .setFillStyle(particleColor, aquatic ? 0.38 : 0.64)
      .setVisible(true);
  }

  private hidePropulsion(): void {
    this.propulsionEmitter?.stop();
    this.leftPropulsionGlow.setVisible(false);
    this.rightPropulsionGlow.setVisible(false);
  }

  private syncPropulsion(time: number, phase: number): void {
    if (!this.active) {
      this.hidePropulsion();
      return;
    }

    const attackBoost = time < this.attackMotionUntil ? 0.3 : 0;
    const pulse =
      0.78 +
      ((Math.sin(time * 0.018 + this.phaseOffset) + 1) / 2) * 0.28 +
      (phase - 1) * 0.08 +
      attackBoost;
    let centerX = this.x;
    let propulsionY = this.y + this.displayHeight * 0.42;
    let spacing = this.displayWidth * 0.16;
    let glowWidth = Math.max(18, this.displayWidth * 0.075);
    let glowHeight = Math.max(42, this.displayHeight * 0.18);

    switch (this.motionProfile) {
      case 'aquatic':
        propulsionY = this.y + this.displayHeight * 0.36;
        spacing = this.displayWidth * 0.24;
        glowWidth = Math.max(18, this.displayWidth * 0.07);
        glowHeight = glowWidth;
        break;
      case 'toxic':
        centerX = this.x - this.direction * this.displayWidth * 0.08;
        propulsionY = this.y + this.displayHeight * 0.28;
        spacing = this.displayWidth * 0.2;
        glowHeight = this.displayHeight * 0.22;
        break;
      case 'energy':
        propulsionY = this.y + this.displayHeight * 0.4;
        spacing = this.displayWidth * 0.2;
        glowHeight = this.displayHeight * 0.24;
        break;
      case 'aircraft':
        centerX = this.x - this.direction * this.displayWidth * 0.18;
        propulsionY = this.y + this.displayHeight * 0.02;
        spacing = this.displayWidth * 0.24;
        glowWidth = this.displayWidth * 0.08;
        glowHeight = this.displayHeight * 0.27;
        break;
      case 'carrier':
        propulsionY = this.y + this.displayHeight * 0.32;
        spacing = this.displayWidth * 0.27;
        glowWidth = this.displayWidth * 0.09;
        glowHeight = this.displayHeight * 0.2;
        break;
      case 'hover':
        break;
    }

    const glowAlpha = Phaser.Math.Clamp(0.42 + pulse * 0.24, 0.42, 0.9);
    this.leftPropulsionGlow
      .setPosition(centerX - spacing, propulsionY)
      .setDisplaySize(glowWidth * pulse, glowHeight * pulse)
      .setAngle(-this.flightLean * 0.35)
      .setAlpha(glowAlpha)
      .setVisible(true);
    this.rightPropulsionGlow
      .setPosition(centerX + spacing, propulsionY)
      .setDisplaySize(glowWidth * pulse, glowHeight * pulse)
      .setAngle(-this.flightLean * 0.35)
      .setAlpha(glowAlpha)
      .setVisible(true);
    this.propulsionEmitter
      ?.setPosition(centerX, propulsionY + glowHeight * 0.28)
      .setAlpha(Phaser.Math.Clamp(0.7 + pulse * 0.2, 0.7, 1));
  }

  private configureAnimatedParts(texture: string): void {
    const frame = this.scene.textures.getFrame(texture);
    const width = frame?.width ?? this.width;
    const height = frame?.height ?? this.height;
    const displayWidth = this.displayWidth;
    const displayHeight = this.displayHeight;
    const configure = (
      part: Phaser.GameObjects.Image,
      x: number,
      y: number,
      cropWidth: number,
      cropHeight: number,
      centerX: number,
      centerY: number,
    ): void => {
      this.partRigs.set(part, {
        centerX,
        centerY,
        width: cropWidth,
        height: cropHeight,
      });
      part
        .setTexture(texture)
        .setCrop(
          Math.round(width * x),
          Math.round(height * y),
          Math.round(width * cropWidth),
          Math.round(height * cropHeight),
        )
        .setDisplaySize(displayWidth * cropWidth, displayHeight * cropHeight)
        .setOrigin(0.5)
        .setAlpha(0.98)
        .clearTint()
        .setActive(true)
        .setVisible(true);
    };

    // The crop centers match their real position in the original artwork.
    // Overlap around shoulders and hips keeps the joints visually connected.
    configure(this.headLayer, 0.16, 0, 0.68, 0.34, 0.5, 0.17);
    configure(this.leftArmLayer, 0, 0.18, 0.45, 0.5, 0.225, 0.43);
    configure(this.rightArmLayer, 0.55, 0.18, 0.45, 0.5, 0.775, 0.43);
    configure(this.leftLegLayer, 0.08, 0.55, 0.44, 0.45, 0.3, 0.775);
    configure(this.rightLegLayer, 0.48, 0.55, 0.44, 0.45, 0.7, 0.775);
  }

  private positionAnimatedPart(
    part: Phaser.GameObjects.Image,
    extraX: number,
    extraY: number,
    extraAngle: number,
  ): void {
    const rig = this.partRigs.get(part);
    if (!rig) {
      return;
    }
    const facing = this.flipX ? -1 : 1;
    part
      .setDisplaySize(this.displayWidth * rig.width, this.displayHeight * rig.height)
      .setPosition(
        this.x + (rig.centerX - 0.5) * this.displayWidth * facing + extraX,
        this.y + (rig.centerY - 0.5) * this.displayHeight + extraY,
      )
      .setFlipX(this.flipX)
      .setAngle(this.angle + extraAngle)
      .setAlpha(this.alpha)
      .setActive(true)
      .setVisible(true);
  }

  private syncAnimatedParts(time: number, phase: number, targetX: number): void {
    if (!this.articulated) {
      return;
    }
    const profileFrequency =
      this.motionProfile === 'aquatic' ? 0.007 : this.motionProfile === 'energy' ? 0.011 : 0.009;
    const gait = Math.sin(time * (profileFrequency + phase * 0.0012) + this.phaseOffset);
    const stride = Math.cos(time * (profileFrequency + phase * 0.0012) + this.phaseOffset);
    const breathing = Math.sin(time * 0.006 + this.phaseOffset);
    const attackProgress = Phaser.Math.Clamp(
      1 - (this.attackMotionUntil - time) / 460,
      0,
      1,
    );
    const attack = time < this.attackMotionUntil
      ? Math.sin(attackProgress * Math.PI) * (1 + phase * 0.16)
      : 0;
    const hitJitter = time < this.hitMotionUntil ? Math.sin(time * 0.11) * 5 : 0;
    const facing = this.direction;
    const targetTracking = Phaser.Math.Clamp(
      (targetX - this.x) / (GAME_WIDTH * 0.32),
      -1,
      1,
    );
    const thrustKick =
      ((Math.sin(time * 0.018 + this.phaseOffset) + 1) / 2) * (2.5 + phase * 0.8);
    const leftFootLift = Math.max(0, stride) * (4 + phase) + thrustKick;
    const rightFootLift = Math.max(0, -stride) * (4 + phase) + thrustKick;

    this.positionAnimatedPart(
      this.headLayer,
      targetTracking * 7 + gait * 1.5 + hitJitter,
      -Math.abs(breathing) * 2.5 - attack * 5,
      targetTracking * 7 + gait * 1.8 - attack * facing * 4.5,
    );
    this.positionAnimatedPart(
      this.leftArmLayer,
      (-stride * 4 - attack * 11) * facing + hitJitter * 0.35,
      gait * 2.5 + attack * 2,
      (gait * 5.5 - attack * 13) * facing,
    );
    this.positionAnimatedPart(
      this.rightArmLayer,
      (stride * 4 + attack * 16) * facing + hitJitter * 0.35,
      -gait * 2.5 - attack * 3,
      (-gait * 5.5 + attack * 17) * facing,
    );
    this.positionAnimatedPart(
      this.leftLegLayer,
      -gait * 3.5 * facing,
      leftFootLift,
      -gait * 4.5 * facing + attack * 2,
    );
    this.positionAnimatedPart(
      this.rightLegLayer,
      gait * 3.5 * facing,
      rightFootLift,
      gait * 4.5 * facing - attack * 2,
    );
  }

  takeHit(damage: number): boolean {
    this.health = Math.max(0, this.health - Math.max(1, damage));
    this.hitMotionUntil = this.scene.time.now + 220;
    try {
      this.setTintFill(0xffffff);
      this.animatedParts.forEach((part) => {
        if (part.active) {
          part.setTintFill(0xffffff);
        }
      });
      this.scene.time.delayedCall(65, () => {
        if (this.active) {
          try {
            this.clearTint();
            this.animatedParts.forEach((part) => part.clearTint());
          } catch {
            // The damage has already been applied; a visual effect is optional.
          }
        }
      });
    } catch {
      // A tint failure on a mobile renderer must not cancel boss damage.
    }
    return this.health <= 0;
  }

  recycle(): void {
    this.scene.tweens.killTweensOf(this);
    this.hideAnimatedParts();
    this.hidePropulsion();
    this.disableBody(true, true);
    this.setActive(false).setVisible(false).clearTint();
  }

  destroy(fromScene?: boolean): void {
    this.propulsionEmitter?.destroy();
    this.propulsionEmitter = undefined;
    this.leftPropulsionGlow.destroy();
    this.rightPropulsionGlow.destroy();
    this.animatedParts.forEach((part) => part.destroy());
    super.destroy(fromScene);
  }
}
