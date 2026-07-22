import Phaser from 'phaser';
import type { ItemDefinition } from '../config/items.js';

/**
 * A falling item (good product, bad obstacle or power-up).
 * Reused from a group pool to avoid allocations and memory leaks.
 */
export class FallingItem extends Phaser.Physics.Arcade.Sprite {
  public definition!: ItemDefinition;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(definition: ItemDefinition, x: number, fallSpeed: number): void {
    this.definition = definition;
    this.setTexture(definition.key);
    this.setDisplaySize(80, 80);
    this.enableBody(true, x, -60, true, true);
    this.setActive(true).setVisible(true);
    this.setAngle(0);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, fallSpeed);
    body.setSize(this.width * 0.8, this.height * 0.8);

    // Gentle spin for visual life.
    this.scene.tweens.add({
      targets: this,
      angle: Phaser.Math.Between(-12, 12),
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  setFallSpeed(speed: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocityY(speed);
    }
  }

  recycle(): void {
    this.scene.tweens.killTweensOf(this);
    this.disableBody(true, true);
    this.setActive(false).setVisible(false);
  }
}
