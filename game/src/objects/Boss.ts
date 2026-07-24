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
  private attackMotionUntil = 0;
  private hitMotionUntil = 0;
  private readonly headLayer: Phaser.GameObjects.Image;
  private readonly leftArmLayer: Phaser.GameObjects.Image;
  private readonly rightArmLayer: Phaser.GameObjects.Image;
  private readonly leftLegLayer: Phaser.GameObjects.Image;
  private readonly rightLegLayer: Phaser.GameObjects.Image;
  private readonly animatedParts: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'jefe-mundo-1');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.headLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.leftArmLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.rightArmLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.leftLegLayer = scene.add.image(x, y, 'jefe-mundo-1');
    this.rightLegLayer = scene.add.image(x, y, 'jefe-mundo-1');
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
    this.nextAttackAt =
      time + this.entranceDuration + Phaser.Math.Clamp(700 - difficultyLevel * 25, 350, 650);
    this.phaseOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.attackMotionUntil = 0;
    this.hitMotionUntil = 0;

    const texture = options.texture ?? definition.bossTexture;
    this.articulated =
      definition.bossPattern !== 'atomic-aircraft' &&
      definition.bossPattern !== 'alien-carrier';
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
    this.syncAnimatedParts(time, 1);
  }

  updateBoss(
    time: number,
    difficultySpeedMultiplier: number,
    delta: number,
  ): BossUpdateResult {
    if (!this.active) {
      return { shouldAttack: false, phase: 1 };
    }

    const phase = this.healthRatio > 0.66 ? 1 : this.healthRatio > 0.32 ? 2 : 3;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !body.enable) {
      return { shouldAttack: false, phase };
    }
    const patrolSpeed = (68 + this.definition.id * 8 + phase * 12) * difficultySpeedMultiplier;
    const hover = Math.sin(time * 0.0045 + this.phaseOffset);
    const frameSeconds = Phaser.Math.Clamp(delta, 0, 50) / 1000;
    const halfWidth = this.displayWidth * 0.5;
    let nextX = this.x + patrolSpeed * this.direction * frameSeconds;
    if (this.patrolMinX !== undefined && this.patrolMaxX !== undefined) {
      if (nextX <= this.patrolMinX) {
        nextX = this.patrolMinX;
        this.direction = 1;
      } else if (nextX >= this.patrolMaxX) {
        nextX = this.patrolMaxX;
        this.direction = -1;
      }
    } else if (this.direction > 0 && nextX - halfWidth > GAME_WIDTH) {
      nextX = -halfWidth;
    } else if (this.direction < 0 && nextX + halfWidth < 0) {
      nextX = GAME_WIDTH + halfWidth;
    }
    const entranceProgress = Phaser.Math.Clamp(
      (time - this.spawnedAt) / this.entranceDuration,
      0,
      1,
    );
    const entranceEase = Phaser.Math.Easing.Cubic.Out(entranceProgress);
    const settledY = this.baseY + hover * (12 + phase * 3);
    const nextY = Phaser.Math.Linear(this.entranceStartY, settledY, entranceEase);
    body.reset(nextX, nextY);
    body.setVelocity(0, 0);
    this.setPosition(nextX, nextY);
    this.setFlipX(this.direction < 0);
    this.angle = Phaser.Math.Linear(this.angle, hover * 2.8 + this.direction * 1.5, 0.07);
    this.setScale(
      this.baseScaleX * (1 + hover * 0.018 + (phase - 1) * 0.012),
      this.baseScaleY * (1 - hover * 0.014 + (phase - 1) * 0.012),
    );
    this.syncAnimatedParts(time, phase);

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
  }

  hideAnimatedParts(): void {
    this.animatedParts.forEach((part) => part.setActive(false).setVisible(false));
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
    ): void => {
      part
        .setTexture(texture)
        .setCrop(
          Math.round(width * x),
          Math.round(height * y),
          Math.round(width * cropWidth),
          Math.round(height * cropHeight),
        )
        .setDisplaySize(displayWidth, displayHeight)
        .setOrigin(0.5)
        .setAlpha(1)
        .setActive(true)
        .setVisible(true);
    };

    // Humanoid boss portraits share the same canvas proportions. The
    // overlapping crops add articulated motion while preserving the artwork.
    configure(this.headLayer, 0.16, 0, 0.68, 0.32);
    configure(this.leftArmLayer, 0, 0.18, 0.45, 0.5);
    configure(this.rightArmLayer, 0.55, 0.18, 0.45, 0.5);
    configure(this.leftLegLayer, 0.1, 0.55, 0.43, 0.45);
    configure(this.rightLegLayer, 0.47, 0.55, 0.43, 0.45);
  }

  private syncAnimatedParts(time: number, phase: number): void {
    if (!this.articulated) {
      return;
    }
    const gait = Math.sin(time * (0.009 + phase * 0.0015) + this.phaseOffset);
    const stride = Math.cos(time * (0.009 + phase * 0.0015) + this.phaseOffset);
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

    this.animatedParts.forEach((part) => {
      part
        .setScale(this.scaleX, this.scaleY)
        .setFlipX(this.flipX)
        .setAlpha(this.alpha);
    });

    this.headLayer
      .setPosition(this.x + gait * 2 + hitJitter, this.y - Math.abs(gait) * 2 - attack * 4)
      .setAngle(this.angle + gait * 2.4 - attack * facing * 4);
    this.leftArmLayer
      .setPosition(this.x - stride * 5 - attack * 8 * facing, this.y + gait * 2)
      .setAngle(this.angle + gait * 6 - attack * 11 * facing);
    this.rightArmLayer
      .setPosition(this.x + stride * 5 + attack * 13 * facing, this.y - gait * 2)
      .setAngle(this.angle - gait * 6 + attack * 14 * facing);
    this.leftLegLayer
      .setPosition(this.x - gait * 5, this.y + Math.max(0, stride) * 5)
      .setAngle(this.angle - gait * 4);
    this.rightLegLayer
      .setPosition(this.x + gait * 5, this.y + Math.max(0, -stride) * 5)
      .setAngle(this.angle + gait * 4);
  }

  takeHit(damage: number): boolean {
    this.health = Math.max(0, this.health - Math.max(1, damage));
    this.hitMotionUntil = this.scene.time.now + 220;
    try {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(65, () => {
        if (this.active) {
          try {
            this.clearTint();
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
    this.disableBody(true, true);
    this.setActive(false).setVisible(false).clearTint();
  }

  destroy(fromScene?: boolean): void {
    this.animatedParts.forEach((part) => part.destroy());
    super.destroy(fromScene);
  }
}
