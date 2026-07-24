import Phaser from 'phaser';
import { Player } from './Player.js';

/**
 * Temporary delivery combat vehicle. It follows the real Player body so all
 * existing movement and collision rules continue to work while Daddy rides.
 */
export class CombatBike {
  public readonly maxHealth = 6;

  private health = 0;
  private expiresAt = 0;
  private active = false;
  private root?: Phaser.GameObjects.Container;
  private visualLayer?: Phaser.GameObjects.Container;
  private logo?: Phaser.GameObjects.Image;
  private frontWheel?: Phaser.GameObjects.Graphics;
  private rearWheel?: Phaser.GameObjects.Graphics;
  private armorFill?: Phaser.GameObjects.Rectangle;
  private statusText?: Phaser.GameObjects.Text;
  private lastFacing: -1 | 1 = 1;
  private skidUntil = 0;
  private nextSmokeAt = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get isActive(): boolean {
    return this.active;
  }

  get armor(): number {
    return this.health;
  }

  get x(): number {
    return this.root?.x ?? 0;
  }

  get y(): number {
    return this.root?.y ?? 0;
  }

  activate(player: Player, expiresAt: number): void {
    this.root?.destroy(true);
    this.health = this.maxHealth;
    this.expiresAt = expiresAt;
    this.active = true;
    this.lastFacing = player.getFacingDirection();
    this.skidUntil = 0;
    this.nextSmokeAt = 0;

    const root = this.scene.add.container(player.x, player.y + 12).setDepth(8);
    const visualLayer = this.scene.add.container(0, 0);
    const bike = this.scene.add
      .image(0, 0, 'moto-combate-daddy')
      .setDisplaySize(304, 178)
      .setOrigin(0.5, 1);
    const logo = this.scene.add
      .image(90, -114, 'logo-daddy-game-chicken')
      .setDisplaySize(54, 24)
      .setOrigin(0.5);
    const frontWheel = this.createWheel(-92, -36);
    const rearWheel = this.createWheel(89, -36);
    visualLayer.add([bike, logo, frontWheel, rearWheel]);

    const armorBg = this.scene.add
      .rectangle(0, -202, 164, 14, 0x020718, 0.92)
      .setStrokeStyle(2, 0xffffff, 0.8);
    const armorFill = this.scene.add
      .rectangle(-78, -202, 156, 8, 0x21e6c1, 1)
      .setOrigin(0, 0.5);
    const statusText = this.scene.add
      .text(0, -220, 'MOTO 6/6  •  10s', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        stroke: '#020718',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    root.add([visualLayer, armorBg, armorFill, statusText]);
    this.root = root;
    this.visualLayer = visualLayer;
    this.logo = logo;
    this.frontWheel = frontWheel;
    this.rearWheel = rearWheel;
    this.armorFill = armorFill;
    this.statusText = statusText;

    player.setVisible(false);
    this.syncFacing(this.lastFacing);
    root.setScale(0.35).setAlpha(0);
    this.scene.tweens.add({
      targets: root,
      scale: 1,
      alpha: 1,
      duration: 360,
      ease: 'Back.out',
    });
  }

  update(player: Player, delta: number): boolean {
    if (!this.active || !this.root || !this.visualLayer) {
      return false;
    }

    const body = player.body as Phaser.Physics.Arcade.Body;
    const facing = player.getFacingDirection();
    if (facing !== this.lastFacing && Math.abs(body.velocity.x) > 80) {
      this.skidUntil = this.scene.time.now + 430;
      this.lastFacing = facing;
      this.syncFacing(facing);
      this.emitSkidSmoke(player, true);
    } else {
      this.syncFacing(facing);
    }

    this.root.setPosition(player.x, player.y + 12);
    const wheelTurn = body.velocity.x * Phaser.Math.Clamp(delta, 0, 50) * 0.00014;
    this.frontWheel?.setRotation((this.frontWheel.rotation + wheelTurn) % (Math.PI * 2));
    this.rearWheel?.setRotation((this.rearWheel.rotation + wheelTurn) % (Math.PI * 2));

    const moving = Math.abs(body.velocity.x) > 35;
    const skid = this.scene.time.now < this.skidUntil;
    const lean = skid
      ? facing * -8
      : Phaser.Math.Clamp(body.velocity.x * 0.011, -6, 6);
    this.visualLayer.angle = Phaser.Math.Linear(this.visualLayer.angle, lean, 0.14);
    this.visualLayer.y = Math.sin(this.scene.time.now * (moving ? 0.025 : 0.009)) * (moving ? 2.5 : 1.2);

    if (moving && this.scene.time.now >= this.nextSmokeAt) {
      this.nextSmokeAt = this.scene.time.now + (skid ? 65 : 125);
      this.emitSkidSmoke(player, skid);
    }

    const seconds = Math.max(0, Math.ceil((this.expiresAt - this.scene.time.now) / 1000));
    this.statusText?.setText(`MOTO ${this.health}/${this.maxHealth}  •  ${seconds}s`);
    return this.scene.time.now >= this.expiresAt;
  }

  takeHit(damage: number): boolean {
    if (!this.active) {
      return false;
    }
    this.health = Math.max(0, this.health - Math.max(1, damage));
    this.armorFill?.setScale(this.health / this.maxHealth, 1);
    if (this.root) {
      this.scene.tweens.add({
        targets: this.root,
        alpha: 0.32,
        duration: 70,
        yoyo: true,
        repeat: 2,
      });
    }
    return this.health <= 0;
  }

  deactivate(player: Player, destroyed: boolean): void {
    if (!this.active && !this.root) {
      player.setVisible(true);
      return;
    }
    this.active = false;
    player.setVisible(true);
    const root = this.root;
    this.root = undefined;
    this.visualLayer = undefined;
    this.logo = undefined;
    this.frontWheel = undefined;
    this.rearWheel = undefined;
    this.armorFill = undefined;
    this.statusText = undefined;
    if (!root) {
      return;
    }
    this.scene.tweens.add({
      targets: root,
      alpha: 0,
      angle: destroyed ? 28 : 0,
      scale: destroyed ? 1.38 : 0.72,
      y: root.y + (destroyed ? -55 : 18),
      duration: destroyed ? 460 : 280,
      ease: destroyed ? 'Cubic.out' : 'Cubic.in',
      onComplete: () => root.destroy(true),
    });
  }

  destroy(): void {
    this.active = false;
    this.root?.destroy(true);
    this.root = undefined;
  }

  private syncFacing(facing: -1 | 1): void {
    if (!this.visualLayer) {
      return;
    }
    // The generated source faces left. Mirroring the layer makes it follow
    // Daddy while a second logo flip keeps the wordmark readable.
    const layerScale = -facing;
    this.visualLayer.setScale(layerScale, 1);
    this.logo?.setFlipX(layerScale < 0);
  }

  private createWheel(x: number, y: number): Phaser.GameObjects.Graphics {
    const wheel = this.scene.add.graphics({ x, y });
    wheel.lineStyle(3, 0xffd21e, 0.95);
    wheel.strokeCircle(0, 0, 21);
    wheel.lineStyle(2, 0x43d9ff, 0.9);
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      wheel.lineBetween(0, 0, Math.cos(angle) * 18, Math.sin(angle) * 18);
    }
    wheel.fillStyle(0xffffff, 0.95);
    wheel.fillCircle(0, 0, 4);
    return wheel;
  }

  private emitSkidSmoke(player: Player, intense: boolean): void {
    const facing = player.getFacingDirection();
    const smoke = this.scene.add
      .circle(
        player.x - 84 * facing,
        player.y - 10 + Phaser.Math.Between(-4, 4),
        intense ? 11 : 7,
        intense ? 0xffd21e : 0xdce7ef,
        intense ? 0.72 : 0.48,
      )
      .setDepth(6);
    this.scene.tweens.add({
      targets: smoke,
      x: smoke.x - 34 * facing,
      y: smoke.y - Phaser.Math.Between(18, 34),
      scale: intense ? 2.4 : 1.8,
      alpha: 0,
      duration: intense ? 520 : 390,
      ease: 'Cubic.out',
      onComplete: () => smoke.destroy(),
    });
  }
}
