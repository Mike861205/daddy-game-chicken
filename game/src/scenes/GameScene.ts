import Phaser from 'phaser';
import {
  COLORS,
  COLORS_HEX,
  GAME_HEIGHT,
  GAME_WIDTH,
  REGISTRY,
  SCENES,
} from '../config/constants.js';
import {
  BAD_ITEMS,
  GOOD_ITEMS,
  POWER_DURATIONS,
  POWER_ITEMS,
  WEAPON_ITEMS,
  type ItemDefinition,
  type PowerType,
  type WeaponType,
} from '../config/items.js';
import { ENEMIES, ENEMY_ORDER, type EnemyType } from '../config/enemies.js';
import { WEAPONS } from '../config/weapons.js';
import { Enemy } from '../objects/Enemy.js';
import { FallingItem } from '../objects/FallingItem.js';
import { Player } from '../objects/Player.js';
import { audioManager } from '../services/audio.js';
import { generateUuid } from '../utils/uuid.js';
import type { GameResult, PublicConfig } from '../types.js';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private config!: PublicConfig;

  private score = 0;
  private lives = 3;
  private timeLeft = 60;
  private comboCount = 0;
  private caughtItems = 0;
  private missedItems = 0;
  private paused = false;
  private gameOver = false;

  private baseFallSpeed = 220;
  private spawnDelay = 850;
  private difficultyLevel = 5;
  private difficultyScoreMultiplier = 1;
  private difficultySpeedMultiplier = 1;
  private enemySpawnDelay = 9000;
  private firstEnemyDelay = 4800;
  private maxActiveEnemies = 2;
  private badItemWeightMultiplier = 0.55;
  private coverDrainMultiplier = 1;

  private activePowers = new Map<PowerType, number>();
  private activeWeapon: WeaponType | null = null;
  private weaponAmmo = 0;
  private nextShotAt = 0;
  private nextWeaponIndex = 0;
  private nextEmptyFeedbackAt = 0;
  private coverEnergy = 100;
  private coverRechargeAt = 0;
  private coverBroken = false;
  private nextEnemyDamageAt = 0;
  private nextEnemyIndex = 0;
  private enemySpawnId = 0;

  // HUD.
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private coverText!: Phaser.GameObjects.Text;
  private equippedWeaponSprite?: Phaser.GameObjects.Image;

  // Timers.
  private spawnTimer?: Phaser.Time.TimerEvent;
  private countdownTimer?: Phaser.Time.TimerEvent;
  private weaponTimer?: Phaser.Time.TimerEvent;
  private firstWeaponTimer?: Phaser.Time.TimerEvent;
  private enemyTimer?: Phaser.Time.TimerEvent;
  private firstEnemyTimer?: Phaser.Time.TimerEvent;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyShift?: Phaser.Input.Keyboard.Key;

  private leftPressed = false;
  private rightPressed = false;
  private dragging = false;
  private firePressed = false;
  private coverPressed = false;

  private visibilityHandler?: () => void;

  constructor() {
    super(SCENES.Game);
  }

  create(): void {
    this.resetState();
    this.config = this.registry.get(REGISTRY.publicConfig) as PublicConfig;
    this.applyDifficultySettings(this.config.difficultyLevel);
    this.timeLeft = this.config.durationSeconds;
    const livesAdjustment = this.difficultyLevel <= 1 ? 1 : this.difficultyLevel === 10 ? -1 : 0;
    this.lives = Math.max(1, this.config.startingLives + livesAdjustment);

    this.drawBackground();
    this.createPlayer();
    this.createProjectileTextures();
    this.createItemsGroup();
    this.createProjectilesGroup();
    this.createEnemiesSystem();
    this.createHud();
    this.createTouchControls();
    this.createKeyboardControls();
    this.createPauseButton();
    this.setupVisibilityPause();

    this.startTimers();
    this.showCountdownStart();

    // Clean up listeners and timers when the scene shuts down.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private resetState(): void {
    this.score = 0;
    this.timeLeft = 60;
    this.comboCount = 0;
    this.caughtItems = 0;
    this.missedItems = 0;
    this.paused = false;
    this.gameOver = false;
    this.activePowers.clear();
    this.activeWeapon = null;
    this.weaponAmmo = 0;
    this.nextShotAt = 0;
    this.nextWeaponIndex = 0;
    this.nextEmptyFeedbackAt = 0;
    this.coverEnergy = 100;
    this.coverRechargeAt = 0;
    this.coverBroken = false;
    this.nextEnemyDamageAt = 0;
    this.nextEnemyIndex = 0;
    this.enemySpawnId = 0;
    this.leftPressed = false;
    this.rightPressed = false;
    this.dragging = false;
    this.firePressed = false;
    this.coverPressed = false;
  }

  private applyDifficultySettings(rawLevel: number): void {
    this.difficultyLevel = Phaser.Math.Clamp(Math.round(rawLevel ?? 5), 0, 10);
    const offset = (this.difficultyLevel - 5) / 5;
    this.difficultyScoreMultiplier = 1 - 0.2 * offset;
    this.difficultySpeedMultiplier = 1 + 0.28 * offset;
    this.baseFallSpeed = Math.round(220 * this.difficultySpeedMultiplier);
    this.spawnDelay = Math.round(850 * (1 - 0.24 * offset));
    this.enemySpawnDelay = Math.round(9000 * (1 - 0.35 * offset));
    this.firstEnemyDelay = Math.round(4800 * (1 - 0.25 * offset));
    this.maxActiveEnemies = this.difficultyLevel <= 2 ? 1 : this.difficultyLevel >= 8 ? 3 : 2;
    this.badItemWeightMultiplier = 0.55 * (1 + 0.5 * offset);
    this.coverDrainMultiplier = 1 + 0.35 * offset;
  }

  private adjustPointsForDifficulty(points: number): number {
    return Math.max(5, Math.round((points * this.difficultyScoreMultiplier) / 5) * 5);
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e63d0, 0x1e63d0, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (this.textures.exists('fondo-los-cabos')) {
      this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'fondo-los-cabos')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.3);
    }

    // Slow glints give the arena depth without competing with the pickups.
    const ambience = this.add.particles(0, 0, '__WHITE', {
      x: { min: 24, max: GAME_WIDTH - 24 },
      y: { min: 190, max: GAME_HEIGHT - 190 },
      lifespan: { min: 2200, max: 4400 },
      speedY: { min: -24, max: -8 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.42, end: 0 },
      tint: [0x43d9ff, 0x21e6c1, 0xffffff],
      frequency: 240,
      blendMode: 'ADD',
    });
    ambience.setDepth(1);

    // Ground line.
    const ground = this.add.graphics();
    ground.fillStyle(COLORS.yellow, 1);
    ground.fillRect(0, GAME_HEIGHT - 130, GAME_WIDTH, 8);
  }

  private createPlayer(): void {
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT - 150);
    this.player.setDepth(5);
  }

  private createProjectileTextures(): void {
    if (!this.textures.exists('bala-moderna')) {
      const modern = this.make.graphics({ x: 0, y: 0 }, false);
      modern.fillStyle(0x43d9ff, 0.35);
      modern.fillRoundedRect(0, 0, 18, 54, 9);
      modern.fillStyle(0xffffff, 1);
      modern.fillRoundedRect(5, 4, 8, 42, 4);
      modern.generateTexture('bala-moderna', 18, 54);
      modern.destroy();
    }

    if (!this.textures.exists('bala-historica')) {
      const historic = this.make.graphics({ x: 0, y: 0 }, false);
      historic.fillStyle(0xffd21e, 0.32);
      historic.fillCircle(22, 22, 22);
      historic.fillStyle(0x33200f, 1);
      historic.fillCircle(22, 22, 15);
      historic.lineStyle(4, 0xffb347, 1);
      historic.strokeCircle(22, 22, 16);
      historic.generateTexture('bala-historica', 44, 44);
      historic.destroy();
    }

    if (!this.textures.exists('bala-poseidon')) {
      const poseidon = this.make.graphics({ x: 0, y: 0 }, false);
      poseidon.fillStyle(0x21e6e6, 0.28);
      poseidon.fillRoundedRect(0, 0, 20, 66, 10);
      poseidon.fillStyle(0xffffff, 1);
      poseidon.fillTriangle(10, 0, 2, 20, 18, 20);
      poseidon.fillStyle(0x43d9ff, 1);
      poseidon.fillRoundedRect(7, 17, 6, 45, 3);
      poseidon.generateTexture('bala-poseidon', 20, 66);
      poseidon.destroy();
    }

    if (!this.textures.exists('ataque-fuego')) {
      const fire = this.make.graphics({ x: 0, y: 0 }, false);
      fire.fillStyle(0xff3b1f, 0.32);
      fire.fillCircle(24, 24, 24);
      fire.fillStyle(0xffd21e, 1);
      fire.fillCircle(24, 24, 14);
      fire.fillStyle(0xffffff, 0.9);
      fire.fillCircle(20, 19, 6);
      fire.generateTexture('ataque-fuego', 48, 48);
      fire.destroy();
    }

    if (!this.textures.exists('ataque-corsario')) {
      const cannon = this.make.graphics({ x: 0, y: 0 }, false);
      cannon.fillStyle(0xffb347, 0.28);
      cannon.fillCircle(22, 22, 22);
      cannon.fillStyle(0x18223f, 1);
      cannon.fillCircle(22, 22, 15);
      cannon.lineStyle(3, 0xffd16a, 1);
      cannon.strokeCircle(22, 22, 16);
      cannon.generateTexture('ataque-corsario', 44, 44);
      cannon.destroy();
    }

    if (!this.textures.exists('ataque-abisal')) {
      const water = this.make.graphics({ x: 0, y: 0 }, false);
      water.fillStyle(0x21e6e6, 0.28);
      water.fillCircle(23, 23, 23);
      water.fillStyle(0x43d9ff, 0.94);
      water.fillCircle(23, 23, 14);
      water.fillStyle(0xffffff, 0.95);
      water.fillCircle(18, 18, 5);
      water.generateTexture('ataque-abisal', 46, 46);
      water.destroy();
    }
  }

  private createItemsGroup(): void {
    this.items = this.physics.add.group({
      classType: FallingItem,
      maxSize: 40,
      runChildUpdate: false,
    });

    this.physics.add.overlap(
      this.player,
      this.items,
      (_player, itemObj) => {
        const item = itemObj as FallingItem;
        if (item.active) {
          this.onCatch(item);
        }
      },
      undefined,
      this,
    );
  }

  private createProjectilesGroup(): void {
    this.projectiles = this.physics.add.group({
      maxSize: 48,
      runChildUpdate: false,
    });

    this.physics.add.overlap(
      this.projectiles,
      this.items,
      (projectileObj, itemObj) => {
        const projectile = projectileObj as Phaser.Physics.Arcade.Image;
        const item = itemObj as FallingItem;
        if (projectile.active && item.active) {
          this.onProjectileHit(projectile, item);
        }
      },
      undefined,
      this,
    );
  }

  private createEnemiesSystem(): void {
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: 8,
      runChildUpdate: false,
    });
    this.enemyProjectiles = this.physics.add.group({
      maxSize: 40,
      runChildUpdate: false,
    });

    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (projectileObj, enemyObj) => {
        const projectile = projectileObj as Phaser.Physics.Arcade.Image;
        const enemy = enemyObj as Enemy;
        if (projectile.active && enemy.active) {
          this.onProjectileHitEnemy(projectile, enemy);
        }
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.player,
      this.enemyProjectiles,
      (_playerObj, projectileObj) => {
        const projectile = projectileObj as Phaser.Physics.Arcade.Image;
        if (projectile.active) {
          this.onEnemyProjectileHit(projectile);
        }
      },
      undefined,
      this,
    );
  }

  private createHud(): void {
    const style = {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '34px',
      color: COLORS_HEX.white,
      stroke: '#000000',
      strokeThickness: 5,
    } as const;

    this.scoreText = this.add.text(24, 24, 'Puntos: 0', style).setDepth(20);
    this.timeText = this.add
      .text(GAME_WIDTH - 24, 24, '60', { ...style, fontSize: '44px', color: COLORS_HEX.yellow })
      .setOrigin(1, 0)
      .setDepth(20);
    this.livesText = this.add.text(24, 72, '❤️❤️❤️', { ...style, fontSize: '32px' }).setDepth(20);
    this.comboText = this.add
      .text(GAME_WIDTH / 2, 130, '', { ...style, fontSize: '30px', color: COLORS_HEX.neon })
      .setOrigin(0.5)
      .setDepth(20);
    this.powerText = this.add
      .text(GAME_WIDTH / 2, 176, '', { ...style, fontSize: '24px', color: COLORS_HEX.yellow })
      .setOrigin(0.5)
      .setDepth(20);
    this.weaponText = this.add
      .text(GAME_WIDTH / 2, 214, '🎯 ATRAPA UN ARMA', {
        ...style,
        fontSize: '22px',
        color: '#9fdcff',
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.coverText = this.add
      .text(GAME_WIDTH / 2, 250, '🛡 COBERTURA 100%', {
        ...style,
        fontSize: '19px',
        color: '#64f4ff',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.updateHud();
  }

  private createKeyboardControls(): void {
    if (!this.input.keyboard) {
      return;
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  private createTouchControls(): void {
    // Large left/right touch buttons at the bottom corners.
    const btnY = GAME_HEIGHT - 90;
    const leftBtn = this.makeControlButton(78, btnY, '◀');
    const rightBtn = this.makeControlButton(GAME_WIDTH - 78, btnY, '▶');
    const coverBtn = this.makeCoverButton(238, btnY);
    const fireBtn = this.makeFireButton(482, btnY);

    leftBtn.on('pointerdown', () => (this.leftPressed = true));
    leftBtn.on('pointerup', () => (this.leftPressed = false));
    leftBtn.on('pointerout', () => (this.leftPressed = false));
    rightBtn.on('pointerdown', () => (this.rightPressed = true));
    rightBtn.on('pointerup', () => (this.rightPressed = false));
    rightBtn.on('pointerout', () => (this.rightPressed = false));
    fireBtn.on('pointerdown', () => {
      this.firePressed = true;
      this.tryFireWeapon();
    });
    fireBtn.on('pointerup', () => (this.firePressed = false));
    fireBtn.on('pointerout', () => (this.firePressed = false));
    coverBtn.on('pointerdown', () => (this.coverPressed = true));
    coverBtn.on('pointerup', () => (this.coverPressed = false));
    coverBtn.on('pointerout', () => (this.coverPressed = false));

    // Drag anywhere in the play area to move the player.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && pointer.y < GAME_HEIGHT - 160) {
        this.dragging = true;
        this.player.moveToward(pointer.x);
      }
    });
    this.input.on('pointerup', () => {
      if (this.dragging) {
        this.dragging = false;
        this.player.clearTarget();
      }
    });
  }

  private makeControlButton(x: number, y: number, symbol: string): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(30);
    const g = this.add.graphics();
    g.fillStyle(COLORS.yellow, 0.85);
    g.fillCircle(0, 0, 60);
    g.lineStyle(4, COLORS.white, 1);
    g.strokeCircle(0, 0, 60);
    const text = this.add
      .text(0, 0, symbol, { fontFamily: 'Arial Black', fontSize: '48px', color: COLORS_HEX.blue })
      .setOrigin(0.5);
    container.add([g, text]);
    container.setSize(120, 120);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, 60),
      Phaser.Geom.Circle.Contains,
    );
    return container;
  }

  private makeFireButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(30);
    const glow = this.add.circle(0, 0, 68, COLORS.red, 0.2);
    const button = this.add
      .circle(0, 0, 57, COLORS.red, 0.94)
      .setStrokeStyle(4, COLORS.white, 1);
    const icon = this.add
      .text(0, -7, '✦', {
        fontFamily: 'Arial Black',
        fontSize: '45px',
        color: COLORS_HEX.yellow,
        stroke: '#06143a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 34, 'FUEGO', {
        fontFamily: 'Arial Black',
        fontSize: '15px',
        color: COLORS_HEX.white,
        stroke: '#06143a',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add([glow, button, icon, label]);
    container.setSize(136, 136);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, 68), Phaser.Geom.Circle.Contains);

    this.tweens.add({
      targets: glow,
      scale: { from: 0.88, to: 1.08 },
      alpha: { from: 0.14, to: 0.36 },
      duration: 720,
      yoyo: true,
      repeat: -1,
    });
    container.on('pointerdown', () => container.setScale(0.94));
    container.on('pointerup', () => container.setScale(1));
    container.on('pointerout', () => container.setScale(1));
    return container;
  }

  private makeCoverButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(30);
    const glow = this.add.circle(0, 0, 61, 0x43d9ff, 0.2);
    const button = this.add
      .circle(0, 0, 53, COLORS.blueLight, 0.95)
      .setStrokeStyle(4, 0x64f4ff, 1);
    const icon = this.add
      .text(0, -7, '🛡', {
        fontFamily: 'Arial Black',
        fontSize: '39px',
        color: COLORS_HEX.white,
        stroke: '#06143a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 32, 'CUBRIR', {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: COLORS_HEX.white,
        stroke: '#06143a',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add([glow, button, icon, label]);
    container.setSize(122, 122);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, 61), Phaser.Geom.Circle.Contains);
    container.on('pointerdown', () => container.setScale(0.94));
    container.on('pointerup', () => container.setScale(1));
    container.on('pointerout', () => container.setScale(1));
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.34 },
      scale: { from: 0.9, to: 1.07 },
      duration: 820,
      yoyo: true,
      repeat: -1,
    });
    return container;
  }

  private createPauseButton(): void {
    const btn = this.add
      .text(GAME_WIDTH - 24, 80, '⏸', {
        fontFamily: 'Arial Black',
        fontSize: '40px',
        color: COLORS_HEX.white,
      })
      .setOrigin(1, 0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => this.togglePause());
  }

  private setupVisibilityPause(): void {
    this.visibilityHandler = () => {
      if (document.hidden && !this.paused && !this.gameOver) {
        this.togglePause();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private startTimers(): void {
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      loop: true,
      callback: () => this.spawnItem(),
    });

    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.onTick(),
    });

    // Arsenal drops are independent from food spawns, making every weapon
    // available during a normal 60-second round.
    this.firstWeaponTimer = this.time.delayedCall(3200, () => this.spawnWeaponPickup());
    this.weaponTimer = this.time.addEvent({
      delay: 12000,
      loop: true,
      callback: () => this.spawnWeaponPickup(),
    });
    this.firstEnemyTimer = this.time.delayedCall(this.firstEnemyDelay, () => this.spawnEnemy());
    this.enemyTimer = this.time.addEvent({
      delay: this.enemySpawnDelay,
      loop: true,
      callback: () => this.spawnEnemy(),
    });
  }

  private showCountdownStart(): void {
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '¡LISTO!', {
        fontFamily: 'Arial Black',
        fontSize: '90px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: label,
      scale: { from: 0.3, to: 1.2 },
      alpha: { from: 1, to: 0 },
      duration: 900,
      onComplete: () => label.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.paused || this.gameOver) {
      return;
    }

    // Keyboard / touch movement.
    const left = this.leftPressed || this.cursors?.left.isDown || this.keyA?.isDown;
    const right = this.rightPressed || this.cursors?.right.isDown || this.keyD?.isDown;
    const wantsCover = Boolean(this.coverPressed || this.keyS?.isDown || this.keyShift?.isDown);
    this.updateCover(wantsCover, delta);

    if (this.player.isCovering()) {
      this.player.stopMoving();
    } else if (!this.dragging) {
      if (left && !right) {
        this.player.moveLeft();
      } else if (right && !left) {
        this.player.moveRight();
      } else {
        this.player.stopMoving();
      }
    }
    this.player.update();

    const wantsToFire = this.firePressed || this.keySpace?.isDown || this.keyF?.isDown;
    if (wantsToFire && !this.player.isCovering()) {
      this.tryFireWeapon();
    }
    this.updateEquippedWeaponSprite();

    // Magnet power: pull good items toward the player.
    const magnetActive = this.isPowerActive('magnet');

    this.items.children.each((child) => {
      const item = child as FallingItem;
      if (!item.active) {
        return true;
      }
      item.updateFlight(delta);
      if (magnetActive && item.definition.category === 'good') {
        const dx = this.player.x - item.x;
        item.x += Phaser.Math.Clamp(dx, -8, 8);
      }
      // Item fell past the bottom.
      if (item.y > GAME_HEIGHT + 40) {
        this.onMiss(item);
      }
      return true;
    });

    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) {
        return true;
      }
      const result = enemy.updateEnemy(this.time.now, this.difficultySpeedMultiplier);
      if (result.shouldShoot) {
        this.spawnEnemyAttack(enemy);
      }
      if (result.expired) {
        enemy.escape();
      }
      return true;
    });

    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (
        projectile.active &&
        (projectile.y < -90 || projectile.x < -60 || projectile.x > GAME_WIDTH + 60)
      ) {
        this.recycleProjectile(projectile);
      }
      return true;
    });

    this.enemyProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (
        projectile.active &&
        (projectile.y > GAME_HEIGHT - 112 || projectile.x < -70 || projectile.x > GAME_WIDTH + 70)
      ) {
        this.recycleEnemyProjectile(projectile);
      }
      return true;
    });

    this.updatePowersExpiry();
  }

  private onTick(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    this.timeLeft -= 1;
    this.timeText.setText(String(Math.max(0, this.timeLeft)));

    if (this.timeLeft <= 5 && this.timeLeft > 0) {
      audioManager.play('countdown');
      this.timeText.setColor(COLORS_HEX.red);
      this.tweens.add({ targets: this.timeText, scale: 1.3, duration: 120, yoyo: true });
    }

    // Gradually increase difficulty.
    if (this.timeLeft === 40 || this.timeLeft === 20) {
      this.baseFallSpeed += 60;
      this.spawnDelay = Math.max(450, this.spawnDelay - 150);
      this.spawnTimer?.remove();
      this.spawnTimer = this.time.addEvent({
        delay: this.spawnDelay,
        loop: true,
        callback: () => this.spawnItem(),
      });
    }

    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------

  private spawnItem(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    const definition = this.pickItem();
    this.spawnDefinition(definition);
  }

  private spawnWeaponPickup(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    const definition = WEAPON_ITEMS[this.nextWeaponIndex % WEAPON_ITEMS.length];
    this.nextWeaponIndex += 1;
    this.spawnDefinition(definition, 0.74);

    const notice = this.add
      .text(GAME_WIDTH / 2, 268, `⚡ ${definition.label.toUpperCase()} EN CAMINO`, {
        fontFamily: 'Arial Black',
        fontSize: '23px',
        color: COLORS_HEX.yellow,
        stroke: '#06143a',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(38);
    this.tweens.add({
      targets: notice,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.78, to: 1 },
      duration: 220,
      yoyo: true,
      hold: 700,
      onComplete: () => notice.destroy(),
    });
  }

  private spawnDefinition(definition: ItemDefinition, speedMultiplier = 1): void {
    const x = Phaser.Math.Between(72, GAME_WIDTH - 72);
    const slowFactor = this.isPowerActive('slow') ? 0.55 : 1;
    const speed =
      (this.baseFallSpeed + Phaser.Math.Between(-30, 60)) * slowFactor * speedMultiplier;

    const item = this.items.get() as FallingItem | null;
    if (!item) {
      return;
    }
    item.spawn(definition, x, speed);
  }

  private spawnEnemy(): void {
    if (this.paused || this.gameOver || this.enemies.countActive(true) >= this.maxActiveEnemies) {
      return;
    }
    const orderIndex = this.nextEnemyIndex % ENEMY_ORDER.length;
    const type = ENEMY_ORDER[orderIndex];
    this.nextEnemyIndex += 1;
    const enemy = this.enemies.get() as Enemy | null;
    if (!enemy) {
      return;
    }

    const x = Phaser.Math.Between(105, GAME_WIDTH - 105);
    const y = 350 + orderIndex * 118;
    this.enemySpawnId += 1;
    enemy.spawn(type, x, y, this.time.now, this.enemySpawnId);

    const definition = ENEMIES[type];
    const notice = this.add
      .text(GAME_WIDTH / 2, 292, `⚠ ${definition.label}`, {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: definition.colorHex,
        stroke: '#020718',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(48);
    this.tweens.add({
      targets: notice,
      y: 276,
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: 'Cubic.out',
      onComplete: () => notice.destroy(),
    });
  }

  private pickItem(): ItemDefinition {
    // Rivals are now the main danger. Keep environmental hazards present, but
    // reduce their frequency so the player has room to read and dodge attacks.
    const pool: { def: ItemDefinition; weight: number }[] = [
      ...GOOD_ITEMS.map((def) => ({ def, weight: def.weight })),
      ...BAD_ITEMS.map((def) => ({ def, weight: def.weight * this.badItemWeightMultiplier })),
      ...POWER_ITEMS.map((def) => ({ def, weight: def.weight })),
    ];
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.def;
      }
    }
    return GOOD_ITEMS[0];
  }

  // ---------------------------------------------------------------------------
  // Collisions
  // ---------------------------------------------------------------------------

  private onCatch(item: FallingItem): void {
    const def = item.definition;
    const x = item.x;
    const y = item.y;
    item.recycle();

    if (def.category === 'good') {
      this.handleGoodCatch(def, x, y);
    } else if (def.category === 'bad') {
      this.handleBadCatch(x, y);
    } else if (def.category === 'power' && def.power) {
      this.handlePowerCatch(def, x, y);
    } else if (def.category === 'weapon' && def.weapon) {
      this.handleWeaponCatch(def.weapon, x, y);
    }
    this.updateHud();
  }

  private handleGoodCatch(def: ItemDefinition, x: number, y: number): void {
    this.caughtItems += 1;
    this.comboCount += 1;

    const base = def.special
      ? this.config.scoring.specialItemPoints
      : this.config.scoring.normalItemPoints;

    let multiplier = 1;
    if (this.comboCount >= 5) {
      multiplier = this.config.scoring.combo5Multiplier;
    } else if (this.comboCount >= 3) {
      multiplier = this.config.scoring.combo3Multiplier;
    }

    if (this.isPowerActive('double') || this.isPowerActive('combo')) {
      multiplier *= 2;
    }

    const points = this.adjustPointsForDifficulty(base * multiplier);
    this.score += points;

    audioManager.play(multiplier > 1 ? 'combo' : 'catch');
    this.showFloatingText(x, y, `+${points}`, multiplier > 1 ? COLORS_HEX.neon : COLORS_HEX.yellow);
    this.emitSparkle(x, y, def.color);
    this.player.celebrate();

    if (this.comboCount === 3 || this.comboCount === 5) {
      this.comboText.setText(`¡COMBO x${multiplier}!`);
      this.tweens.add({ targets: this.comboText, scale: 1.4, duration: 150, yoyo: true });
    }
  }

  private handleBadCatch(x: number, y: number): void {
    if (this.isPowerActive('shield')) {
      this.showFloatingText(x, y, 'ESCUDO', COLORS_HEX.neon);
      audioManager.play('power');
      return;
    }
    this.comboCount = 0;
    this.lives -= 1;
    audioManager.play('error');
    this.showFloatingText(x, y, '-1 VIDA', COLORS_HEX.red);
    this.player.hitFlash();
    this.cameras.main.shake(200, 0.012);
    this.triggerVibration();

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private handlePowerCatch(def: ItemDefinition, x: number, y: number): void {
    const power = def.power as PowerType;
    const duration = POWER_DURATIONS[power];
    this.activePowers.set(power, this.time.now + duration);
    audioManager.play('power');
    this.showFloatingText(x, y, def.label.toUpperCase(), COLORS_HEX.neon);
    this.emitSparkle(x, y, def.color);

    if (power === 'shield') {
      this.player.showShield();
    }
  }

  private handleWeaponCatch(weapon: WeaponType, x: number, y: number): void {
    const definition = WEAPONS[weapon];
    this.activeWeapon = weapon;
    this.weaponAmmo = definition.ammo;
    this.nextShotAt = this.time.now + 180;
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = this.add
      .image(this.player.x + 42, this.player.y - 70, definition.textureKey)
      .setDisplaySize(weapon === 'poseidon' ? 82 : 74, weapon === 'poseidon' ? 82 : 74)
      .setDepth(9);

    audioManager.play('power');
    this.emitSparkle(x, y, definition.color);
    this.showFloatingText(x, y, definition.label, definition.colorHex);
    this.player.celebrate();
    this.updateHud();

    const banner = this.add
      .text(GAME_WIDTH / 2, 330, `${definition.label}\n¡LISTO PARA DISPARAR!`, {
        fontFamily: 'Arial Black',
        fontSize: '30px',
        color: definition.colorHex,
        stroke: '#020718',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: banner,
      y: 300,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.72, to: 1.08 },
      duration: 1250,
      ease: 'Cubic.out',
      onComplete: () => banner.destroy(),
    });
  }

  private onMiss(item: FallingItem): void {
    const wasGood = item.definition.category === 'good';
    item.recycle();
    if (wasGood) {
      this.missedItems += 1;
      this.comboCount = 0;
      this.updateHud();
    }
  }

  private updateCover(requested: boolean, delta: number): void {
    if (requested && !this.coverBroken && this.coverEnergy > 0) {
      this.player.setCovering(true);
      this.coverEnergy = Math.max(0, this.coverEnergy - delta * 0.032 * this.coverDrainMultiplier);
      this.coverRechargeAt = this.time.now + 900;
      if (this.coverEnergy <= 0) {
        this.coverBroken = true;
        this.player.setCovering(false);
      }
    } else {
      this.player.setCovering(false);
      if (this.time.now >= this.coverRechargeAt) {
        this.coverEnergy = Math.min(100, this.coverEnergy + delta * 0.022);
      }
      if (this.coverBroken && this.coverEnergy >= 35) {
        this.coverBroken = false;
      }
    }

    const rounded = Math.round(this.coverEnergy);
    this.coverText
      .setText(this.coverBroken ? `🛡 RECARGANDO ${rounded}%` : `🛡 COBERTURA ${rounded}%`)
      .setColor(rounded > 25 ? '#64f4ff' : COLORS_HEX.red);
  }

  // ---------------------------------------------------------------------------
  // Arsenal
  // ---------------------------------------------------------------------------

  private spawnEnemyAttack(enemy: Enemy): void {
    const type = enemy.definition.type;
    const spread = type === 'abyss' ? [-0.18, 0, 0.18] : [0];
    for (const offset of spread) {
      this.spawnEnemyProjectile(enemy, type, offset);
    }
    audioManager.play(type === 'corsair' ? 'blast' : 'enemy');
    this.emitMuzzleFlash(enemy.x, enemy.y + 28, enemy.definition.color);
  }

  private spawnEnemyProjectile(enemy: Enemy, type: EnemyType, angleOffset: number): void {
    const definition = ENEMIES[type];
    const projectile = this.enemyProjectiles.get(
      enemy.x,
      enemy.y + 35,
      definition.projectileTexture,
    ) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) {
      return;
    }

    projectile
      .setTexture(definition.projectileTexture)
      .setActive(true)
      .setVisible(true)
      .setPosition(enemy.x, enemy.y + 35)
      .setDisplaySize(type === 'corsair' ? 36 : 40, type === 'corsair' ? 36 : 40)
      .setDepth(16)
      .setAlpha(1)
      .setData('enemyType', type);

    const targetLead = type === 'corsair'
      ? (this.player.body as Phaser.Physics.Arcade.Body).velocity.x * 0.16
      : 0;
    const angle =
      Phaser.Math.Angle.Between(
        enemy.x,
        enemy.y,
        this.player.x + targetLead,
        this.player.y - 38,
      ) + angleOffset;
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(projectile.x, projectile.y);
    body.setAllowGravity(false);
    body.setCircle(projectile.width * 0.4);
    const projectileSpeed = definition.projectileSpeed * this.difficultySpeedMultiplier;
    body.setVelocity(Math.cos(angle) * projectileSpeed, Math.sin(angle) * projectileSpeed);
    projectile.setAngularVelocity(type === 'corsair' ? 280 : type === 'fire' ? 150 : 0);
  }

  private onEnemyProjectileHit(projectile: Phaser.Physics.Arcade.Image): void {
    const x = projectile.x;
    const y = projectile.y;
    const type = projectile.getData('enemyType') as EnemyType;
    this.recycleEnemyProjectile(projectile);

    if (this.isPowerActive('shield') || this.player.isCovering()) {
      if (!this.isPowerActive('shield')) {
        this.coverEnergy = Math.max(0, this.coverEnergy - 16);
        this.coverRechargeAt = this.time.now + 1100;
        if (this.coverEnergy <= 0) {
          this.coverBroken = true;
          this.player.setCovering(false);
        }
      }
      audioManager.play('power');
      this.showFloatingText(this.player.x, this.player.y - 120, '¡BLOQUEADO!', '#64f4ff');
      this.emitSparkle(x, y, 0x64f4ff);
      return;
    }

    if (this.time.now < this.nextEnemyDamageAt) {
      return;
    }
    this.nextEnemyDamageAt = this.time.now + 1050;
    this.lives -= 1;
    this.comboCount = 0;
    audioManager.play('error');
    this.player.hitFlash();
    this.showFloatingText(
      this.player.x,
      this.player.y - 105,
      `-${ENEMIES[type].label} • 1 VIDA`,
      COLORS_HEX.red,
    );
    this.cameras.main.shake(220, 0.014);
    this.triggerVibration();
    this.updateHud();
    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private onProjectileHitEnemy(
    projectile: Phaser.Physics.Arcade.Image,
    enemy: Enemy,
  ): void {
    const weaponType = projectile.getData('weapon') as WeaponType;
    const hitEnemies = projectile.getData('hitEnemies') as Set<number> | undefined;
    if (hitEnemies?.has(enemy.spawnId)) {
      return;
    }
    hitEnemies?.add(enemy.spawnId);

    if (weaponType === 'historic') {
      const x = enemy.x;
      const y = enemy.y;
      this.recycleProjectile(projectile);
      this.explodeEnemies(x, y);
      return;
    }

    if (weaponType === 'modern') {
      this.recycleProjectile(projectile);
    }
    this.damageEnemy(enemy, 1);
  }

  private explodeEnemies(x: number, y: number): void {
    const radius = 145;
    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (
        enemy.active &&
        Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius
      ) {
        this.damageEnemy(enemy, 2);
      }
      return true;
    });
    this.emitShockwave(x, y, radius, WEAPONS.historic.color);
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    if (!enemy.active) {
      return;
    }
    const x = enemy.x;
    const y = enemy.y;
    const defeated = enemy.takeHit(damage);
    if (!defeated) {
      this.showFloatingText(x, y, `-${damage} PODER`, '#ffffff');
      this.emitSparkle(x, y, enemy.definition.color);
      audioManager.play('shot');
      return;
    }

    const { points: basePoints, label, color, colorHex } = enemy.definition;
    const points = this.adjustPointsForDifficulty(basePoints);
    enemy.recycle();
    this.score += points;
    this.showFloatingText(x, y, `+${points} • ${label}`, colorHex);
    this.emitSparkle(x, y, color);
    audioManager.play('combo');
    this.cameras.main.shake(130, 0.007);
    this.updateHud();
  }

  private recycleEnemyProjectile(projectile: Phaser.Physics.Arcade.Image): void {
    projectile.setAngularVelocity(0);
    projectile.disableBody(true, true);
    projectile.setActive(false).setVisible(false);
  }

  private tryFireWeapon(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    if (!this.activeWeapon || this.weaponAmmo <= 0) {
      if (this.time.now >= this.nextEmptyFeedbackAt) {
        this.nextEmptyFeedbackAt = this.time.now + 900;
        this.showFloatingText(this.player.x, this.player.y - 120, 'ATRAPA UN ARMA', '#9fdcff');
      }
      return;
    }

    const weapon = WEAPONS[this.activeWeapon];
    if (this.time.now < this.nextShotAt) {
      return;
    }
    this.nextShotAt = this.time.now + weapon.cooldownMs;

    const facing = this.player.getFacingDirection();
    const muzzleX = this.player.x + 34 * facing;
    const muzzleY = this.player.y - 112;
    if (this.activeWeapon === 'poseidon') {
      this.spawnProjectile(muzzleX - 22, muzzleY + 4, this.activeWeapon, -105);
      this.spawnProjectile(muzzleX, muzzleY - 8, this.activeWeapon, 0);
      this.spawnProjectile(muzzleX + 22, muzzleY + 4, this.activeWeapon, 105);
    } else {
      this.spawnProjectile(muzzleX, muzzleY, this.activeWeapon, 0);
    }

    this.weaponAmmo -= 1;
    this.player.fireRecoil();
    audioManager.play(this.activeWeapon === 'historic' ? 'blast' : 'shot');
    this.emitMuzzleFlash(muzzleX, muzzleY, weapon.color);
    if (this.equippedWeaponSprite) {
      this.tweens.add({
        targets: this.equippedWeaponSprite,
        scaleX: this.equippedWeaponSprite.scaleX * 1.12,
        scaleY: this.equippedWeaponSprite.scaleY * 0.9,
        duration: 65,
        yoyo: true,
      });
    }
    this.updateHud();

    if (this.weaponAmmo <= 0) {
      this.time.delayedCall(180, () => this.clearWeapon());
    }
  }

  private spawnProjectile(x: number, y: number, type: WeaponType, velocityX: number): void {
    const weapon = WEAPONS[type];
    const projectile = this.projectiles.get(x, y, weapon.projectileTexture) as
      | Phaser.Physics.Arcade.Image
      | null;
    if (!projectile) {
      return;
    }

    projectile
      .setTexture(weapon.projectileTexture)
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setDepth(12)
      .setAlpha(1)
      .setData('weapon', type)
      .setData('hitEnemies', new Set<number>());
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    body.setAllowGravity(false);
    body.setVelocity(velocityX, -weapon.projectileSpeed);
    body.setCircle(0);

    if (type === 'historic') {
      projectile.setDisplaySize(42, 42).setAngularVelocity(320);
      body.setCircle(projectile.width * 0.42);
    } else if (type === 'poseidon') {
      projectile.setDisplaySize(20, 66).setAngle(velocityX * 0.055).setAngularVelocity(0);
      body.setSize(projectile.width * 0.72, projectile.height * 0.86);
    } else {
      projectile.setDisplaySize(18, 54).setAngle(0).setAngularVelocity(0);
      body.setSize(projectile.width * 0.72, projectile.height * 0.86);
    }
  }

  private onProjectileHit(
    projectile: Phaser.Physics.Arcade.Image,
    item: FallingItem,
  ): void {
    if (item.definition.category !== 'bad') {
      return;
    }

    const type = projectile.getData('weapon') as WeaponType;
    if (type === 'historic') {
      const x = item.x;
      const y = item.y;
      this.recycleProjectile(projectile);
      this.explodeObstacles(x, y);
      return;
    }

    if (type === 'modern') {
      this.recycleProjectile(projectile);
      this.destroyObstacle(item, 55, WEAPONS.modern.color);
    } else {
      // Poseidon's bolts pierce, allowing one volley to clear several targets.
      this.destroyObstacle(item, 70, WEAPONS.poseidon.color);
    }
  }

  private explodeObstacles(x: number, y: number): void {
    const radius = 135;
    let destroyed = 0;
    this.items.children.each((child) => {
      const target = child as FallingItem;
      if (
        target.active &&
        target.definition.category === 'bad' &&
        Phaser.Math.Distance.Between(x, y, target.x, target.y) <= radius
      ) {
        this.destroyObstacle(target, destroyed === 0 ? 100 : 75, WEAPONS.historic.color);
        destroyed += 1;
      }
      return true;
    });

    this.emitShockwave(x, y, radius, WEAPONS.historic.color);
    this.cameras.main.shake(110, 0.006);
  }

  private destroyObstacle(item: FallingItem, points: number, color: number): void {
    if (!item.active) {
      return;
    }
    const x = item.x;
    const y = item.y;
    item.recycle();
    const adjustedPoints = this.adjustPointsForDifficulty(points);
    this.score += adjustedPoints;
    this.showFloatingText(x, y, `+${adjustedPoints} DEFENSA`, `#${color.toString(16).padStart(6, '0')}`);
    this.emitSparkle(x, y, color);
    this.updateHud();
  }

  private emitShockwave(x: number, y: number, radius: number, color: number): void {
    const shockwave = this.add
      .circle(x, y, 18, color, 0.42)
      .setStrokeStyle(6, COLORS.yellow, 1)
      .setDepth(34);
    this.tweens.add({
      targets: shockwave,
      scale: radius / 18,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.out',
      onComplete: () => shockwave.destroy(),
    });
  }

  private recycleProjectile(projectile: Phaser.Physics.Arcade.Image): void {
    projectile.setAngularVelocity(0);
    projectile.disableBody(true, true);
    projectile.setActive(false).setVisible(false);
  }

  private emitMuzzleFlash(x: number, y: number, color: number): void {
    const particles = this.add.particles(x, y, '__WHITE', {
      speed: { min: 90, max: 250 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.38, end: 0 },
      lifespan: 180,
      quantity: 7,
      tint: [color, 0xffffff],
      blendMode: 'ADD',
    });
    particles.setDepth(35);
    this.time.delayedCall(210, () => particles.destroy());
  }

  private clearWeapon(): void {
    if (this.weaponAmmo > 0) {
      return;
    }
    this.activeWeapon = null;
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = undefined;
    this.updateHud();
  }

  private updateEquippedWeaponSprite(): void {
    if (!this.equippedWeaponSprite || !this.activeWeapon) {
      return;
    }
    const bob = Math.sin(this.time.now * 0.009) * 2.5;
    const facing = this.player.getFacingDirection();
    this.equippedWeaponSprite
      .setPosition(this.player.x + 43 * facing, this.player.y - 73 + bob)
      .setFlipX(facing < 0)
      .setAngle((this.activeWeapon === 'poseidon' ? -8 : -3) * facing);
  }

  // ---------------------------------------------------------------------------
  // Powers
  // ---------------------------------------------------------------------------

  private isPowerActive(power: PowerType): boolean {
    const expiry = this.activePowers.get(power);
    return expiry !== undefined && expiry > this.time.now;
  }

  private updatePowersExpiry(): void {
    for (const [power, expiry] of this.activePowers) {
      if (expiry <= this.time.now) {
        this.activePowers.delete(power);
        if (power === 'shield') {
          this.player.hideShield();
        }
      }
    }
  }

  private updatePowerHud(): void {
    const labels: Record<PowerType, string> = {
      shield: '🛡 Escudo',
      double: '✨ x2 Puntos',
      slow: '🥤 Lento',
      magnet: '🏍 Imán',
      combo: '🔥 Combo',
    };
    const active: string[] = [];
    for (const power of this.activePowers.keys()) {
      if (this.isPowerActive(power)) {
        active.push(labels[power]);
      }
    }
    this.powerText.setText(active.join('   '));
  }

  // ---------------------------------------------------------------------------
  // HUD helpers
  // ---------------------------------------------------------------------------

  private updateHud(): void {
    this.scoreText.setText(`Puntos: ${this.score}`);
    this.livesText.setText('❤️'.repeat(Math.max(0, this.lives)) || '💀');
    this.comboText.setText(this.comboCount >= 2 ? `Combo: ${this.comboCount}` : '');
    if (this.activeWeapon) {
      const weapon = WEAPONS[this.activeWeapon];
      this.weaponText
        .setText(`⚔ ${weapon.shortLabel}  •  ${this.weaponAmmo} DISPAROS`)
        .setColor(weapon.colorHex);
    } else {
      this.weaponText.setText('🎯 ATRAPA UN ARMA').setColor('#9fdcff');
    }
    this.updatePowerHud();
  }

  private showFloatingText(x: number, y: number, message: string, color: string): void {
    const text = this.add
      .text(x, y, message, {
        fontFamily: 'Arial Black',
        fontSize: '32px',
        color,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: text,
      y: y - 90,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.out',
      onComplete: () => text.destroy(),
    });
  }

  private emitSparkle(x: number, y: number, color: number): void {
    const particles = this.add.particles(x, y, '__WHITE', {
      speed: { min: 60, max: 180 },
      scale: { start: 0.6, end: 0 },
      lifespan: 400,
      quantity: 8,
      tint: color,
      blendMode: 'ADD',
    });
    particles.setDepth(35);
    this.time.delayedCall(420, () => particles.destroy());
  }

  private triggerVibration(): void {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // ignore
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pause / end
  // ---------------------------------------------------------------------------

  private togglePause(): void {
    if (this.gameOver) {
      return;
    }
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.showPauseOverlay();
    } else {
      this.physics.resume();
      this.pauseOverlay?.destroy();
      this.pauseOverlay = undefined;
    }
  }

  private pauseOverlay?: Phaser.GameObjects.Container;

  private showPauseOverlay(): void {
    const overlay = this.add.container(0, 0).setDepth(60);
    const shade = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setOrigin(0)
      .setInteractive();
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'PAUSA', {
        fontFamily: 'Arial Black',
        fontSize: '80px',
        color: COLORS_HEX.yellow,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'Toca para continuar', {
        fontFamily: 'Arial Black',
        fontSize: '32px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    overlay.add([shade, title, hint]);
    shade.on('pointerup', () => this.togglePause());
    this.pauseOverlay = overlay;
  }

  private endGame(): void {
    if (this.gameOver) {
      return;
    }
    this.gameOver = true;
    this.spawnTimer?.remove();
    this.countdownTimer?.remove();
    this.weaponTimer?.remove();
    this.firstWeaponTimer?.remove();
    this.enemyTimer?.remove();
    this.firstEnemyTimer?.remove();
    this.physics.pause();
    audioManager.play('win');

    const result: GameResult = {
      score: this.score,
      caughtItems: this.caughtItems,
      missedItems: this.missedItems,
      livesRemaining: Math.max(0, this.lives),
      durationSeconds: this.config.durationSeconds,
      selectedBranch: (this.registry.get(REGISTRY.selectedBranch) as string) ?? 'auroras',
      clientSessionId: generateUuid(),
    };
    this.registry.set(REGISTRY.lastResult, result);

    this.cameras.main.fade(600, 10, 42, 108);
    this.time.delayedCall(650, () => {
      this.scene.start(SCENES.Result);
    });
  }

  private cleanup(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    this.spawnTimer?.remove();
    this.countdownTimer?.remove();
    this.weaponTimer?.remove();
    this.firstWeaponTimer?.remove();
    this.enemyTimer?.remove();
    this.firstEnemyTimer?.remove();
    this.player.setCovering(false);
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = undefined;
    this.input.removeAllListeners();
  }
}
