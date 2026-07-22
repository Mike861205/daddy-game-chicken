import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import type { WorldDefinition } from '../config/worlds.js';

export interface BossUpdateResult {
  shouldAttack: boolean;
  phase: number;
}

/** Large animated final enemy shared by the five campaign worlds. */
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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'jefe-mundo-1');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  get healthRatio(): number {
    return Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
  }

  spawn(definition: WorldDefinition, time: number, difficultyLevel: number): void {
    this.definition = definition;
    const difficultyHealth = 0.82 + difficultyLevel * 0.036;
    this.maxHealth = Math.max(12, Math.round(definition.bossHealth * difficultyHealth));
    this.health = this.maxHealth;
    this.baseY = 325;
    this.direction = 1;
    this.nextAttackAt = time + 1550;
    this.phaseOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.setTexture(definition.bossTexture);
    this.setDisplaySize(330, 430);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.enableBody(true, GAME_WIDTH / 2, -180, true, true);
    this.setActive(true).setVisible(true).setAlpha(1).setAngle(0).setDepth(11).clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(this.width * 0.58, this.height * 0.68);
    body.setVelocity(0, 0);
  }

  updateBoss(time: number, difficultySpeedMultiplier: number): BossUpdateResult {
    if (!this.active || this.y < this.baseY - 12) {
      return { shouldAttack: false, phase: 1 };
    }

    const phase = this.healthRatio > 0.66 ? 1 : this.healthRatio > 0.32 ? 2 : 3;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const patrolSpeed = (68 + this.definition.id * 8 + phase * 12) * difficultySpeedMultiplier;
    if (this.x <= 158) this.direction = 1;
    if (this.x >= GAME_WIDTH - 158) this.direction = -1;
    body.setVelocityX(patrolSpeed * this.direction);

    const hover = Math.sin(time * 0.0045 + this.phaseOffset);
    this.y = this.baseY + hover * (12 + phase * 3);
    this.angle = Phaser.Math.Linear(this.angle, hover * 2.8 + this.direction * 1.5, 0.07);
    this.setScale(
      this.baseScaleX * (1 + hover * 0.018 + (phase - 1) * 0.012),
      this.baseScaleY * (1 - hover * 0.014 + (phase - 1) * 0.012),
    );

    if (time < this.nextAttackAt) {
      return { shouldAttack: false, phase };
    }
    const enragedFactor = phase === 3 ? 0.63 : phase === 2 ? 0.8 : 1;
    this.nextAttackAt =
      time + (this.definition.attackIntervalMs * enragedFactor) / difficultySpeedMultiplier;
    return { shouldAttack: true, phase };
  }

  takeHit(damage: number): boolean {
    this.health -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(65, () => {
      if (this.active) this.clearTint();
    });
    return this.health <= 0;
  }

  recycle(): void {
    this.scene.tweens.killTweensOf(this);
    this.disableBody(true, true);
    this.setActive(false).setVisible(false).clearTint();
  }
}
