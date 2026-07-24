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
  private readonly categoryAura: Phaser.GameObjects.Arc;
  private readonly dangerLabel: Phaser.GameObjects.Text;
  private readonly combatBikeLogo: Phaser.GameObjects.Image;
  private combatBikeLogoBaseScaleX = 1;
  private combatBikeLogoBaseScaleY = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.categoryAura = scene.add
      .circle(x, y, 52, 0x32e35b, 0.1)
      .setStrokeStyle(4, 0x32e35b, 0.65)
      .setDepth(7)
      .setVisible(false);
    this.dangerLabel = scene.add
      .text(x, y - 62, '⚠  −1 VIDA', {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#8a0822',
        stroke: '#320009',
        strokeThickness: 3,
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.combatBikeLogo = scene.add
      .image(x, y, 'logo-daddy-game-chicken')
      .setDisplaySize(32, 14)
      .setDepth(9)
      .setVisible(false);
    this.setActive(false).setVisible(false);
  }

  spawn(definition: ItemDefinition, x: number, fallSpeed: number): void {
    this.definition = definition;
    this.setTexture(definition.key);
    const size = definition.category === 'weapon' ? 98 : definition.category === 'power' ? 88 : 80;
    const isCombatBike = definition.power === 'combatBike';
    this.setDisplaySize(isCombatBike ? 150 : size, isCombatBike ? 82 : size);
    this.enableBody(true, x, -60, true, true);
    this.setActive(true).setVisible(true);
    this.setAngle(0);
    this.setAlpha(1);
    this.setDepth(8);
    this.combatBikeLogo
      .setDisplaySize(32, 14)
      .setVisible(isCombatBike);
    this.combatBikeLogoBaseScaleX = this.combatBikeLogo.scaleX;
    this.combatBikeLogoBaseScaleY = this.combatBikeLogo.scaleY;

    const auraColor = definition.category === 'bad'
      ? 0xff234f
      : definition.category === 'good'
        ? 0x32e35b
        : definition.category === 'weapon'
          ? 0xffd21e
          : 0x43d9ff;
    this.categoryAura
      .setPosition(x, -60)
      .setDisplaySize(isCombatBike ? 174 : size + 34, isCombatBike ? 106 : size + 34)
      .setFillStyle(auraColor, definition.category === 'bad' ? 0.24 : 0.1)
      .setStrokeStyle(definition.category === 'bad' ? 6 : 3, auraColor, 0.9)
      .setVisible(true);
    this.dangerLabel
      .setPosition(x, -118)
      .setVisible(definition.category === 'bad');
    if (definition.category === 'bad') {
      this.setTint(0xff9aaa);
    } else {
      this.clearTint();
    }

    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.syncCombatBikeLogo();
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
    this.syncCombatBikeLogo();

    const indicatorPulse = (Math.sin(this.flightAge * 0.01 + this.flightPhase) + 1) / 2;
    const isDanger = this.definition.category === 'bad';
    this.categoryAura
      .setPosition(this.x, this.y)
      .setScale(0.94 + indicatorPulse * (isDanger ? 0.18 : 0.08))
      .setAlpha(isDanger ? 0.55 + indicatorPulse * 0.45 : 0.58 + indicatorPulse * 0.2);
    this.dangerLabel
      .setPosition(this.x, this.y - 60)
      .setScale(0.96 + indicatorPulse * 0.08)
      .setAlpha(0.78 + indicatorPulse * 0.22);
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
    this.clearTint();
    this.categoryAura.setVisible(false);
    this.dangerLabel.setVisible(false);
    this.combatBikeLogo.setVisible(false);
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }

  destroy(fromScene?: boolean): void {
    this.categoryAura.destroy();
    this.dangerLabel.destroy();
    this.combatBikeLogo.destroy();
    super.destroy(fromScene);
  }

  private syncCombatBikeLogo(): void {
    if (this.definition?.power !== 'combatBike' || !this.combatBikeLogo.visible) {
      return;
    }
    const angle = Phaser.Math.DegToRad(this.angle);
    const scaleRatioX = this.baseScaleX === 0 ? 1 : this.scaleX / this.baseScaleX;
    const scaleRatioY = this.baseScaleY === 0 ? 1 : this.scaleY / this.baseScaleY;
    const offsetX = 43 * scaleRatioX;
    const offsetY = -22 * scaleRatioY;
    this.combatBikeLogo
      .setPosition(
        this.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
        this.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
      )
      .setAngle(this.angle)
      .setScale(
        this.combatBikeLogoBaseScaleX * scaleRatioX,
        this.combatBikeLogoBaseScaleY * scaleRatioY,
      );
  }
}
