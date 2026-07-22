import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import type { ItemDefinition } from '../config/items.js';

/**
 * A falling item (good product, bad obstacle or power-up).
 * Reused from a group pool to avoid allocations and memory leaks.
 */
export class FallingItem extends Phaser.Physics.Arcade.Sprite {
  public definition!: ItemDefinition;

  private flightAge = 0;
  private flightPhase = 0;
  private horizontalSpeed = 0;
  private driftSpeed = 0;
  private baseScaleX = 1;
  private baseScaleY = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(definition: ItemDefinition, x: number, fallSpeed: number): void {
    this.definition = definition;
    this.setTexture(definition.key);
    const size = definition.category === 'weapon' ? 98 : definition.category === 'power' ? 88 : 80;
    this.setDisplaySize(size, size);
    this.enableBody(true, x, -60, true, true);
    this.setActive(true).setVisible(true);
    this.setAngle(0);
    this.setAlpha(1);

    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.flightAge = 0;
    this.flightPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // Every category has a recognizable flight personality. Products glide,
    // obstacles cut aggressively across the screen and special pickups make
    // wide, eye-catching passes.
    if (definition.category === 'bad') {
      this.horizontalSpeed = Phaser.Math.Between(120, 210);
      this.driftSpeed = Phaser.Math.Between(-45, 45);
    } else if (definition.category === 'weapon') {
      this.horizontalSpeed = Phaser.Math.Between(145, 220);
      this.driftSpeed = Phaser.Math.Between(-30, 30);
    } else if (definition.category === 'power') {
      this.horizontalSpeed = Phaser.Math.Between(105, 175);
      this.driftSpeed = Phaser.Math.Between(-25, 25);
    } else {
      this.horizontalSpeed = Phaser.Math.Between(65, 135);
      this.driftSpeed = Phaser.Math.Between(-20, 20);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, fallSpeed);
    body.setSize(this.width * 0.8, this.height * 0.8);
  }

  /** Bank and weave like a small plane instead of falling on a rigid line. */
  updateFlight(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.active) {
      return;
    }

    this.flightAge += delta;
    const frequency = this.definition.category === 'bad' ? 0.0048 : 0.0034;
    const wave = Math.sin(this.flightAge * frequency + this.flightPhase);
    let velocityX = wave * this.horizontalSpeed + this.driftSpeed;

    // Turn back into the playfield with a visible banking motion.
    if (this.x < 48) {
      velocityX = Math.abs(velocityX) + 90;
      this.driftSpeed = Math.abs(this.driftSpeed);
    } else if (this.x > GAME_WIDTH - 48) {
      velocityX = -Math.abs(velocityX) - 90;
      this.driftSpeed = -Math.abs(this.driftSpeed);
    }

    body.setVelocityX(velocityX);
    const targetAngle = Phaser.Math.Clamp(velocityX * 0.075, -19, 19);
    this.angle = Phaser.Math.Linear(this.angle, targetAngle, 0.14);

    const pulseStrength = this.definition.category === 'weapon' ? 0.085 : 0.035;
    const pulse = Math.sin(this.flightAge * 0.006 + this.flightPhase) * pulseStrength;
    this.setScale(this.baseScaleX * (1 + pulse), this.baseScaleY * (1 - pulse * 0.45));
  }

  setFallSpeed(speed: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocityY(speed);
    }
  }

  recycle(): void {
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScaleX, this.baseScaleY);
    this.setAlpha(1);
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
