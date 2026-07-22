import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import { ENEMIES, type EnemyDefinition, type EnemyType } from '../config/enemies.js';

export interface EnemyUpdateResult {
  shouldShoot: boolean;
  expired: boolean;
}

/** Animated airborne rival that patrols, attacks and can be defeated. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public definition!: EnemyDefinition;
  public spawnId = 0;

  private health = 1;
  private baseY = 0;
  private direction: -1 | 1 = 1;
  private nextShotAt = 0;
  private attackUntil = 0;
  private spawnedAt = 0;
  private phase = 0;
  private baseScaleX = 1;
  private baseScaleY = 1;
  private maxHealth = 1;
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemigos-anim', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.healthBarBg = scene.add
      .rectangle(x, y - 78, 94, 12, 0x020718, 0.82)
      .setStrokeStyle(2, 0xffffff, 0.75)
      .setDepth(13)
      .setVisible(false);
    this.healthBarFill = scene.add
      .rectangle(x - 43, y - 78, 86, 6, 0x21e6c1, 1)
      .setOrigin(0, 0.5)
      .setDepth(14)
      .setVisible(false);
    this.setActive(false).setVisible(false);
  }

  spawn(type: EnemyType, x: number, y: number, time: number, spawnId: number): void {
    this.definition = ENEMIES[type];
    this.spawnId = spawnId;
    this.health = this.definition.health;
    this.maxHealth = this.definition.health;
    this.baseY = y;
    this.direction = x > GAME_WIDTH / 2 ? -1 : 1;
    this.nextShotAt = time + Phaser.Math.Between(850, 1450);
    this.attackUntil = 0;
    this.spawnedAt = time;
    this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.setTexture('enemigos-anim', this.definition.idleFrame);
    this.setDisplaySize(132, 132);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.enableBody(true, x, y, true, true);
    this.setActive(true).setVisible(true).setAlpha(1).setDepth(10).clearTint();
    this.healthBarBg.setVisible(true);
    this.healthBarFill.setVisible(true).setScale(1, 1).setFillStyle(this.definition.color, 1);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(this.definition.patrolSpeed * this.direction);
    body.setSize(this.width * 0.56, this.height * 0.58);
  }

  updateEnemy(time: number, difficultySpeedMultiplier = 1): EnemyUpdateResult {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.x <= 72) {
      this.direction = 1;
    } else if (this.x >= GAME_WIDTH - 72) {
      this.direction = -1;
    }
    body.setVelocityX(this.definition.patrolSpeed * difficultySpeedMultiplier * this.direction);
    this.setFlipX(this.direction < 0);

    const hover = Math.sin(time * 0.0048 + this.phase);
    this.y = this.baseY + hover * 18;
    this.angle = Phaser.Math.Linear(this.angle, hover * 3.5 + this.direction * 2, 0.08);
    this.setScale(
      this.baseScaleX * (1 + hover * 0.025),
      this.baseScaleY * (1 - hover * 0.02),
    );
    this.setFrame(time < this.attackUntil ? this.definition.attackFrame : this.definition.idleFrame);
    this.healthBarBg.setPosition(this.x, this.y - 78);
    this.healthBarFill.setPosition(this.x - 43, this.y - 78);

    let shouldShoot = false;
    if (time >= this.nextShotAt) {
      shouldShoot = true;
      this.attackUntil = time + 460;
      this.nextShotAt =
        time + this.definition.shootIntervalMs / difficultySpeedMultiplier + Phaser.Math.Between(-180, 260);
    }

    return {
      shouldShoot,
      expired: time - this.spawnedAt > 15500,
    };
  }

  takeHit(damage: number): boolean {
    this.health -= damage;
    this.healthBarFill.setScale(Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1), 1);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(75, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    return this.health <= 0;
  }

  recycle(): void {
    this.scene.tweens.killTweensOf(this);
    this.disableBody(true, true);
    this.setActive(false).setVisible(false).clearTint();
    this.healthBarBg.setVisible(false);
    this.healthBarFill.setVisible(false);
  }

  escape(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.setActive(false);
    this.healthBarBg.setVisible(false);
    this.healthBarFill.setVisible(false);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 90,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.in',
      onComplete: () => this.recycle(),
    });
  }

  destroy(fromScene?: boolean): void {
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    super.destroy(fromScene);
  }
}
