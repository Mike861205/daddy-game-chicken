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
  private readonly groundY: number;
  private readonly jumpSpeed = 930;
  private readonly jumpGravity = 2450;
  private jumpVelocity = 0;
  private jumping = false;
  private celebrateUntil = 0;
  private recoilUntil = 0;
  private hitUntil = 0;
  private covering = false;
  private facingDirection: -1 | 1 = 1;
  private visualState = '';
  private hasAnimationSheet: boolean;
  private animationPrefix = 'daddy';
  private usingIntegratedBlaster = false;
  private readonly customOutfitTexture: string | null;
  private animationTextureKey: string;
  private readonly firePoseTextureKey: string | null;

  constructor(scene: Phaser.Scene, x: number, y: number, outfitTexture?: string) {
    const armedTexture = scene.textures.exists('daddy-pollo-armed-anim');
    const animatedTexture = scene.textures.exists('daddy-pollo-anim');
    const customOutfitTexture =
      outfitTexture && outfitTexture !== 'daddy-pollo' && scene.textures.exists(outfitTexture)
        ? outfitTexture
        : null;
    const customAnimationTexture = customOutfitTexture
      && scene.textures.exists(`${customOutfitTexture}-anim`)
      ? `${customOutfitTexture}-anim`
      : null;
    const textureKey = customAnimationTexture ?? customOutfitTexture ?? (armedTexture
      ? 'daddy-pollo-armed-anim'
      : animatedTexture
        ? 'daddy-pollo-anim'
        : 'daddy-pollo');
    super(
      scene,
      x,
      y,
      textureKey,
      customAnimationTexture || (!customOutfitTexture && (armedTexture || animatedTexture))
        ? 0
        : undefined,
    );
    this.customOutfitTexture = customOutfitTexture;
    this.animationTextureKey = textureKey;
    const firePoseKey = `${customOutfitTexture ?? 'daddy-pollo'}-fire-back`;
    this.firePoseTextureKey = scene.textures.exists(firePoseKey) ? firePoseKey : null;
    this.hasAnimationSheet = Boolean(customAnimationTexture)
      || (!customOutfitTexture && (armedTexture || animatedTexture));
    this.usingIntegratedBlaster = !customOutfitTexture && armedTexture;
    this.animationPrefix = customAnimationTexture ?? (armedTexture ? 'daddy-armed' : 'daddy');
    this.groundY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (this.hasAnimationSheet) {
      this.createAnimations(scene, textureKey, this.animationPrefix);
    }

    this.setOrigin(0.5, 0.9);
    const displaySize = this.hasAnimationSheet || customOutfitTexture ? 172 : 120;
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

  /** Start a real jump when Daddy Pollo is standing on the ground. */
  jump(): boolean {
    if (this.jumping || this.covering) {
      return false;
    }
    this.jumping = true;
    this.jumpVelocity = -this.jumpSpeed;
    return true;
  }

  isJumping(): boolean {
    return this.jumping;
  }

  /** Temporarily hand visual control to the between-world cinematic. */
  beginCinematicFlight(): void {
    this.clearTarget();
    this.setCovering(false);
    this.jumping = false;
    this.jumpVelocity = 0;
    this.hideShield();
    this.shadow.setVisible(false);
    this.stop();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }

  /** Restore normal physics and presentation after landing in a new world. */
  endCinematicFlight(): void {
    this.targetX = null;
    this.covering = false;
    this.y = this.groundY;
    this.angle = 0;
    this.alpha = 1;
    this.setScale(this.baseScaleX, this.baseScaleY);
    this.shadow
      .setPosition(this.x, this.groundY + 7)
      .setScale(1)
      .setAlpha(0.42)
      .setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(this.x, this.groundY);
    body.setVelocity(0, 0);
    body.setCollideWorldBounds(true);
    this.visualState = '';
    this.updateCharacterAnimation(0, this.scene.time.now);
  }

  update(delta = 16.67): void {
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

    // The jump uses its own vertical velocity because the rest of the game
    // intentionally runs with global gravity disabled.
    if (this.jumping) {
      const seconds = Phaser.Math.Clamp(delta, 0, 50) / 1000;
      this.jumpVelocity += this.jumpGravity * seconds;
      this.y += this.jumpVelocity * seconds;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.jumpVelocity = 0;
        this.jumping = false;
      }
    } else {
      const stride = Math.sin(now * 0.026);
      const runningHop = speedRatio > 0.08 ? Math.max(0, stride) * 7 * speedRatio : 0;
      const celebrateHop = celebrating ? Math.abs(Math.sin(now * 0.022)) * 9 : 0;
      this.y = Phaser.Math.Linear(this.y, this.groundY - runningHop - celebrateHop, 0.42);
    }

    const stretch = celebrating ? Math.abs(Math.sin(clock * 1.8)) * 0.14 : speedRatio * 0.045;
    const recoilSquash = recoil ? 0.1 : 0;
    this.setScale(
      this.baseScaleX * (1 + breathing * 0.018 + recoilSquash),
      this.baseScaleY * (1 - breathing * 0.026 + stretch - recoilSquash * 0.55),
    );

    const movementLean = recoil ? 0 : Phaser.Math.Clamp(body.velocity.x * 0.009, -4, 4);
    const idleLean = recoil ? 0 : speedRatio < 0.08 ? Math.sin(now * 0.0023) * 1.8 : 0;
    const celebrateWiggle = celebrating ? Math.sin(now * 0.045) * 7 : 0;
    this.angle = Phaser.Math.Linear(
      this.angle,
      movementLean + idleLean + celebrateWiggle,
      0.12,
    );

    const shadowPulse = 1 - Math.abs(breathing) * 0.06;
    const airborne = Phaser.Math.Clamp((this.groundY - this.y) / 240, 0, 1);
    this.shadow
      .setPosition(this.x, this.groundY + 7)
      .setScale(
        shadowPulse + speedRatio * 0.12 - airborne * 0.12,
        shadowPulse - airborne * 0.1,
      )
      .setAlpha(0.34 + speedRatio * 0.13 - airborne * 0.12);
    this.updateShield();
  }

  celebrate(): void {
    this.celebrateUntil = this.scene.time.now + 520;
  }

  fireRecoil(): void {
    this.recoilUntil = this.scene.time.now + 240;
  }

  getFacingDirection(): -1 | 1 {
    return this.facingDirection;
  }

  setIntegratedBlaster(active: boolean): void {
    if (this.customOutfitTexture) {
      this.usingIntegratedBlaster = false;
      return;
    }
    const armedAvailable = this.scene.textures.exists('daddy-pollo-armed-anim');
    const nextIntegrated = active && armedAvailable;
    const nextTexture = nextIntegrated ? 'daddy-pollo-armed-anim' : 'daddy-pollo-anim';
    if (!this.scene.textures.exists(nextTexture)) {
      return;
    }
    if (this.usingIntegratedBlaster === nextIntegrated && this.texture.key === nextTexture) {
      return;
    }

    this.stop();
    this.setTexture(nextTexture, 0);
    this.animationTextureKey = nextTexture;
    this.usingIntegratedBlaster = nextIntegrated;
    this.animationPrefix = nextIntegrated ? 'daddy-armed' : 'daddy';
    this.hasAnimationSheet = true;
    this.visualState = '';
    this.createAnimations(this.scene, nextTexture, this.animationPrefix);
  }

  hasIntegratedBlaster(): boolean {
    return this.usingIntegratedBlaster;
  }

  setCovering(active: boolean): void {
    if (active && this.jumping) {
      return;
    }
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

  private createAnimations(scene: Phaser.Scene, textureKey: string, prefix: string): void {
    if (!scene.anims.exists(`${prefix}-idle`)) {
      scene.anims.create({
        key: `${prefix}-idle`,
        frames: scene.anims.generateFrameNumbers(textureKey, { frames: [0, 1] }),
        frameRate: prefix === 'daddy-armed' ? 3.2 : 2.2,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`${prefix}-run`)) {
      scene.anims.create({
        key: `${prefix}-run`,
        frames: scene.anims.generateFrameNumbers(textureKey, { frames: [2, 3] }),
        frameRate: 11,
        repeat: -1,
      });
    }
  }

  private updateCharacterAnimation(speedRatio: number, now: number): void {
    if (!this.hasAnimationSheet) {
      return;
    }

    let nextState: 'cover' | 'hit' | 'fire' | 'jump' | 'run' | 'idle';
    if (this.covering) {
      nextState = 'cover';
    } else if (now < this.hitUntil) {
      nextState = 'hit';
    } else if (now < this.recoilUntil) {
      nextState = 'fire';
    } else if (this.customOutfitTexture && this.jumping) {
      nextState = 'jump';
    } else if (speedRatio > 0.08) {
      nextState = 'run';
    } else {
      nextState = 'idle';
    }

    if (nextState === this.visualState) {
      if (nextState === 'fire' && this.firePoseTextureKey) {
        this.setFlipX(false);
      }
      return;
    }
    this.visualState = nextState;
    if (nextState === 'idle' || nextState === 'run') {
      this.play(`${this.animationPrefix}-${nextState}`, true);
    } else {
      this.stop();
      if (nextState === 'fire' && this.firePoseTextureKey) {
        this.setTexture(this.firePoseTextureKey);
        this.setFlipX(false);
      } else {
        this.setTexture(this.animationTextureKey, nextState === 'fire' ? 4 : 5);
      }
    }
  }
}
