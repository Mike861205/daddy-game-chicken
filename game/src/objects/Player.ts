import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';

/**
 * The Daddy Pollo player character. Moves horizontally along the bottom.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 620;
  private targetX: number | null = null;
  private shieldGfx: Phaser.GameObjects.Arc | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'daddy-pollo');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.9);
    this.setDisplaySize(120, 120);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    // Narrower catch box centered near the top of the sprite.
    body.setSize(this.width * 0.7, this.height * 0.5);
  }

  get halfWidth(): number {
    return this.displayWidth / 2;
  }

  moveLeft(): void {
    this.targetX = null;
    this.setVelocityX(-this.moveSpeed);
  }

  moveRight(): void {
    this.targetX = null;
    this.setVelocityX(this.moveSpeed);
  }

  stopMoving(): void {
    if (this.targetX === null) {
      this.setVelocityX(0);
    }
  }

  /** Drag / pointer control: move toward an x coordinate. */
  moveToward(x: number): void {
    this.targetX = Phaser.Math.Clamp(x, this.halfWidth, GAME_WIDTH - this.halfWidth);
  }

  clearTarget(): void {
    this.targetX = null;
    this.setVelocityX(0);
  }

  update(): void {
    if (this.targetX !== null) {
      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 6) {
        this.setVelocityX(0);
        this.x = this.targetX;
      } else {
        this.setVelocityX(Math.sign(dx) * this.moveSpeed);
      }
    }
    this.updateShield();
  }

  showShield(): void {
    if (!this.shieldGfx) {
      this.shieldGfx = this.scene.add
        .circle(this.x, this.y - this.displayHeight * 0.4, 80, 0x21e6c1, 0.25)
        .setStrokeStyle(4, 0x21e6c1, 0.9)
        .setDepth(this.depth - 1);
    }
  }

  hideShield(): void {
    this.shieldGfx?.destroy();
    this.shieldGfx = null;
  }

  private updateShield(): void {
    if (this.shieldGfx) {
      this.shieldGfx.setPosition(this.x, this.y - this.displayHeight * 0.4);
    }
  }

  hitFlash(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 2,
    });
  }

  destroy(fromScene?: boolean): void {
    this.hideShield();
    super.destroy(fromScene);
  }
}
