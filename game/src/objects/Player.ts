import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';

/**
 * The Daddy Pollo player character. Moves horizontally along the bottom.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed = 620;
  private targetX: number | null = null;
  private shieldGfx: Phaser.GameObjects.Arc | null = null;
  private coverGfx: Phaser.GameObjects.Arc | null = null;
  private shadow: Phaser.GameObjects.Ellipse;
  private baseScaleX: number;
  private baseScaleY: number;
  private celebrateUntil = 0;
  private recoilUntil = 0;
  private hitUntil = 0;
  private covering = false;
  private facingDirection: -1 | 1 = 1;
  private visualState = '';
  private readonly hasAnimationSheet: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const animatedTexture = scene.textures.exists('daddy-pollo-anim');
    super(scene, x, y, animatedTexture ? 'daddy-pollo-anim' : 'daddy-pollo', animatedTexture ? 0 : undefined);
    this.hasAnimationSheet = animatedTexture;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (animatedTexture) {
      this.createAnimations(scene);
    }

    this.setOrigin(0.5, 0.9);
    const displaySize = animatedTexture ? 158 : 120;
    this.setDisplaySize(displaySize, displaySize);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.shadow = scene.add
      .ellipse(x, y + 7, 92, 22, 0x020718, 0.42)
      .setDepth(4);
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
    this.facingDirection = -1;
    this.setVelocityX(-this.moveSpeed);
  }

  moveRight(): void {
    this.targetX = null;
    this.facingDirection = 1;
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
    this.facingDirection = x < this.x ? -1 : 1;
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

    const body = this.body as Phaser.Physics.Arcade.Body;
    const speedRatio = Phaser.Math.Clamp(Math.abs(body.velocity.x) / this.moveSpeed, 0, 1);
    const now = this.scene.time.now;
    const clock = now * (speedRatio > 0.08 ? 0.018 : 0.0055);
    const breathing = Math.sin(clock);
    const celebrating = now < this.celebrateUntil;
    const recoil = now < this.recoilUntil;

    if (Math.abs(body.velocity.x) > 8) {
      this.facingDirection = body.velocity.x < 0 ? -1 : 1;
    }
    this.setFlipX(this.facingDirection < 0);
    this.updateCharacterAnimation(speedRatio, now);

    const stretch = celebrating ? Math.abs(Math.sin(clock * 1.8)) * 0.14 : speedRatio * 0.045;
    const recoilSquash = recoil ? 0.1 : 0;
    this.setScale(
      this.baseScaleX * (1 + breathing * 0.018 + recoilSquash),
      this.baseScaleY * (1 - breathing * 0.026 + stretch - recoilSquash * 0.55),
    );

    const movementLean = Phaser.Math.Clamp(body.velocity.x * 0.009, -4, 4);
    const idleLean = speedRatio < 0.08 ? Math.sin(now * 0.0023) * 1.8 : 0;
    const celebrateWiggle = celebrating ? Math.sin(now * 0.045) * 7 : 0;
    this.angle = Phaser.Math.Linear(
      this.angle,
      movementLean + idleLean + celebrateWiggle,
      0.12,
    );

    const shadowPulse = 1 - Math.abs(breathing) * 0.06;
    this.shadow
      .setPosition(this.x, this.y + 7)
      .setScale(shadowPulse + speedRatio * 0.12, shadowPulse)
      .setAlpha(0.34 + speedRatio * 0.13);
    this.updateShield();
  }

  celebrate(): void {
    this.celebrateUntil = this.scene.time.now + 520;
  }

  fireRecoil(): void {
    this.recoilUntil = this.scene.time.now + 190;
  }

  getFacingDirection(): -1 | 1 {
    return this.facingDirection;
  }

  setCovering(active: boolean): void {
    if (this.covering === active) {
      return;
    }
    this.covering = active;
    if (active) {
      this.clearTarget();
      this.coverGfx = this.scene.add
        .circle(this.x, this.y - this.displayHeight * 0.44, 72, 0x1450c8, 0.2)
        .setStrokeStyle(5, 0x43d9ff, 0.95)
        .setDepth(this.depth + 1);
    } else {
      this.coverGfx?.destroy();
      this.coverGfx = null;
    }
  }

  isCovering(): boolean {
    return this.covering;
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
    if (this.coverGfx) {
      const pulse = 1 + Math.sin(this.scene.time.now * 0.012) * 0.055;
      this.coverGfx
        .setPosition(this.x, this.y - this.displayHeight * 0.44)
        .setScale(pulse)
        .setAlpha(0.72 + Math.sin(this.scene.time.now * 0.016) * 0.2);
    }
  }

  hitFlash(): void {
    this.hitUntil = this.scene.time.now + 440;
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
    this.coverGfx?.destroy();
    this.coverGfx = null;
    this.shadow.destroy();
    super.destroy(fromScene);
  }

  private createAnimations(scene: Phaser.Scene): void {
    if (!scene.anims.exists('daddy-idle')) {
      scene.anims.create({
        key: 'daddy-idle',
        frames: scene.anims.generateFrameNumbers('daddy-pollo-anim', { frames: [0, 1] }),
        frameRate: 2.2,
        repeat: -1,
      });
    }
    if (!scene.anims.exists('daddy-run')) {
      scene.anims.create({
        key: 'daddy-run',
        frames: scene.anims.generateFrameNumbers('daddy-pollo-anim', { frames: [2, 3] }),
        frameRate: 9,
        repeat: -1,
      });
    }
  }

  private updateCharacterAnimation(speedRatio: number, now: number): void {
    if (!this.hasAnimationSheet) {
      return;
    }

    let nextState: 'cover' | 'hit' | 'fire' | 'run' | 'idle';
    if (this.covering) {
      nextState = 'cover';
    } else if (now < this.hitUntil) {
      nextState = 'hit';
    } else if (now < this.recoilUntil) {
      nextState = 'fire';
    } else if (speedRatio > 0.08) {
      nextState = 'run';
    } else {
      nextState = 'idle';
    }

    if (nextState === this.visualState) {
      return;
    }
    this.visualState = nextState;
    if (nextState === 'idle' || nextState === 'run') {
      this.play(`daddy-${nextState}`, true);
    } else {
      this.stop();
      this.setFrame(nextState === 'fire' ? 4 : 5);
    }
  }
}
