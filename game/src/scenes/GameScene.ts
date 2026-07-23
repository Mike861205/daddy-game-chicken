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
import { WORLDS, type WorldDefinition } from '../config/worlds.js';
import { Boss } from '../objects/Boss.js';
import { Enemy } from '../objects/Enemy.js';
import { FallingItem } from '../objects/FallingItem.js';
import { Player } from '../objects/Player.js';
import { audioManager } from '../services/audio.js';
import { DEFAULT_CONFIG } from '../services/api.js';
import { removeRegistrationOverlays } from '../services/registrationForm.js';
import { generateUuid } from '../utils/uuid.js';
import type { GameResult, PublicConfig } from '../types.js';

interface TouchControl {
  visual: Phaser.GameObjects.Container;
  hitZone: Phaser.GameObjects.Zone;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private boss!: Boss;
  private config!: PublicConfig;

  private score = 0;
  private lives = 3;
  private timeLeft = 60;
  private comboCount = 0;
  private caughtItems = 0;
  private missedItems = 0;
  private paused = false;
  private gameOver = false;
  private bossActive = false;
  private worldTransitioning = false;
  private currentWorldIndex = 0;
  private worldPaceStage = 0;
  private campaignElapsedSeconds = 0;
  private bossProjectileIndex = 0;

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
  private nextBossReinforcementAt = 0;

  // HUD.
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private coverText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossHealthBg!: Phaser.GameObjects.Rectangle;
  private bossHealthFill!: Phaser.GameObjects.Rectangle;
  private equippedWeaponSprite?: Phaser.GameObjects.Image;
  private backgroundImage?: Phaser.GameObjects.Image;
  private worldColorOverlay?: Phaser.GameObjects.Rectangle;
  private worldTransitionOverlay?: Phaser.GameObjects.Container;
  private worldTransitionTrail?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Timers.
  private spawnTimer?: Phaser.Time.TimerEvent;
  private enemyTimer?: Phaser.Time.TimerEvent;
  private firstEnemyTimer?: Phaser.Time.TimerEvent;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyW?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyShift?: Phaser.Input.Keyboard.Key;

  private leftPressed = false;
  private rightPressed = false;
  private dragging = false;
  private dragPointerId: number | null = null;
  private firePressed = false;
  private coverPressed = false;
  private readonly leftTouchPointers = new Set<number>();
  private readonly rightTouchPointers = new Set<number>();
  private readonly fireTouchPointers = new Set<number>();
  private readonly coverTouchPointers = new Set<number>();

  private visibilityHandler?: () => void;

  constructor() {
    super(SCENES.Game);
  }

  create(): void {
    removeRegistrationOverlays();
    this.input.enabled = true;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }
    this.cameras.main.resetFX();
    this.physics.resume();
    this.scale.refresh();
    this.resetState();
    this.config =
      (this.registry.get(REGISTRY.publicConfig) as PublicConfig | undefined) ?? DEFAULT_CONFIG;
    this.applyDifficultySettings(this.config.difficultyLevel);
    this.refreshWorldPace();
    this.timeLeft = this.getBossArrivalSeconds();
    const livesAdjustment = this.difficultyLevel <= 1 ? 1 : this.difficultyLevel === 10 ? -1 : 0;
    this.lives = Math.max(1, this.config.startingLives + livesAdjustment);

    this.drawBackground();
    this.createPlayer();
    this.createProjectileTextures();
    this.createItemsGroup();
    this.createProjectilesGroup();
    this.createEnemiesSystem();
    this.createBossSystem();
    this.createHud();
    this.equipStartingWeapon();
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
    this.bossActive = false;
    this.worldTransitioning = false;
    this.currentWorldIndex = 0;
    this.worldPaceStage = 0;
    this.campaignElapsedSeconds = 0;
    this.bossProjectileIndex = 0;
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
    this.nextBossReinforcementAt = 0;
    this.leftPressed = false;
    this.rightPressed = false;
    this.dragging = false;
    this.dragPointerId = null;
    this.firePressed = false;
    this.coverPressed = false;
    this.leftTouchPointers.clear();
    this.rightTouchPointers.clear();
    this.fireTouchPointers.clear();
    this.coverTouchPointers.clear();
  }

  private getBossArrivalSeconds(): number {
    const configured = this.config?.campaign?.bossArrivalSeconds ?? 120;
    return Phaser.Math.Clamp(Math.round(configured), 30, 600);
  }

  private get currentWorld(): WorldDefinition {
    return WORLDS[Math.min(this.currentWorldIndex, WORLDS.length - 1)];
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

  private refreshWorldPace(): void {
    const offset = (this.difficultyLevel - 5) / 5;
    const worldBoost = this.currentWorldIndex * 0.075;
    const stageBoost = this.worldPaceStage * 0.1;
    this.baseFallSpeed = Math.round(
      220 * this.difficultySpeedMultiplier * (1 + worldBoost + stageBoost),
    );
    this.spawnDelay = Math.max(
      420,
      Math.round(850 * (1 - 0.24 * offset) * (1 - worldBoost * 0.5 - stageBoost * 0.55)),
    );
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e63d0, 0x1e63d0, COLORS.blue, COLORS.blue, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const firstBackground = this.textures.exists(this.currentWorld.backgroundKey)
      ? this.currentWorld.backgroundKey
      : 'fondo-los-cabos';
    this.backgroundImage = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, firstBackground)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.72)
      .setDepth(0);
    this.worldColorOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.currentWorld.color, 0.055)
      .setOrigin(0)
      .setDepth(0.5);

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

  private transitionWorldBackground(world: WorldDefinition): void {
    if (!this.backgroundImage || !this.textures.exists(world.backgroundKey)) {
      return;
    }
    const incoming = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, world.backgroundKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0)
      .setDepth(0);
    const outgoing = this.backgroundImage;
    this.backgroundImage = incoming;
    this.worldColorOverlay?.setFillStyle(world.color, 0.055);
    this.tweens.add({
      targets: incoming,
      alpha: 0.72,
      duration: 950,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: outgoing,
      alpha: 0,
      duration: 950,
      ease: 'Sine.inOut',
      onComplete: () => outgoing.destroy(),
    });
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

  private createBossSystem(): void {
    this.boss = new Boss(this, GAME_WIDTH / 2, -180);
    this.bossProjectiles = this.physics.add.group({
      maxSize: 90,
      runChildUpdate: false,
    });

    this.physics.add.overlap(
      this.player,
      this.bossProjectiles,
      (_playerObj, projectileObj) => {
        const projectile = projectileObj as Phaser.Physics.Arcade.Image;
        try {
          if (projectile.active) {
            this.onEnemyProjectileHit(projectile);
          }
        } catch (error) {
          console.error('Se recuperó un impacto del gran jefe contra Daddy Pollo.', error);
          if (projectile.active) {
            this.recycleEnemyProjectile(projectile);
          }
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
    this.worldText = this.add
      .text(GAME_WIDTH / 2, 32, '', {
        ...style,
        fontSize: '19px',
        color: this.currentWorld.colorHex,
      })
      .setOrigin(0.5, 0)
      .setDepth(21);
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

    this.bossNameText = this.add
      .text(GAME_WIDTH / 2, 108, '', {
        ...style,
        fontSize: '25px',
        color: COLORS_HEX.red,
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
    this.bossHealthBg = this.add
      .rectangle(GAME_WIDTH / 2, 151, 488, 25, 0x020718, 0.9)
      .setStrokeStyle(3, COLORS.white, 0.85)
      .setDepth(24)
      .setVisible(false);
    this.bossHealthFill = this.add
      .rectangle(GAME_WIDTH / 2 - 236, 151, 472, 13, this.currentWorld.color, 1)
      .setOrigin(0, 0.5)
      .setDepth(25)
      .setVisible(false);

    this.updateHud();
  }

  private createKeyboardControls(): void {
    if (!this.input.keyboard) {
      return;
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    // Do not globally preventDefault these keys. Keyboard captures survive at
    // the game-manager level and can otherwise block letters such as "a" in
    // the HTML registration fields after leaving a match.
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F, false);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false);
    this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  private createTouchControls(): void {
    // Large left/right touch buttons at the bottom corners.
    const btnY = GAME_HEIGHT - 90;
    const leftBtn = this.makeControlButton(78, btnY, '◀');
    const rightBtn = this.makeControlButton(GAME_WIDTH - 78, btnY, '▶');
    const coverBtn = this.makeCoverButton(226, btnY);
    const jumpBtn = this.makeJumpButton(GAME_WIDTH / 2, btnY);
    const fireBtn = this.makeFireButton(GAME_WIDTH - 226, btnY);

    this.bindHoldControl(leftBtn, this.leftTouchPointers);
    this.bindHoldControl(rightBtn, this.rightTouchPointers);
    this.bindHoldControl(fireBtn, this.fireTouchPointers, () => this.tryFireWeapon(true));
    this.bindHoldControl(coverBtn, this.coverTouchPointers);
    this.bindTapControl(jumpBtn, () => this.tryJump());

    // Tap or drag anywhere in the play area to move the player. Tracking one
    // pointer keeps a second finger on FIRE/COVER from cancelling movement.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        !this.worldTransitioning &&
        pointer.y < GAME_HEIGHT - 175 &&
        this.dragPointerId === null
      ) {
        this.dragging = true;
        this.dragPointerId = pointer.id;
        this.player.moveToward(pointer.x);
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (
        !this.worldTransitioning &&
        pointer.isDown &&
        pointer.id === this.dragPointerId
      ) {
        this.player.moveToward(pointer.x);
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.releaseTouchPointer(pointer.id);
      if (pointer.id === this.dragPointerId) {
        this.dragging = false;
        this.dragPointerId = null;
        this.player.clearTarget();
      }
    });
    this.input.on('gameout', () => this.clearTouchControls());
  }

  private bindHoldControl(
    control: TouchControl,
    pointers: Set<number>,
    onPress?: () => void,
  ): void {
    const release = (pointer: Phaser.Input.Pointer): void => {
      pointers.delete(pointer.id);
      if (pointers.size === 0) control.visual.setScale(1);
    };

    control.hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Ignore a duplicate browser/Phaser down event for the same physical
      // contact. Every new pointerdown still counts as one deliberate tap.
      if (pointers.has(pointer.id)) {
        return;
      }
      pointers.add(pointer.id);
      control.visual.setScale(0.92);
      onPress?.();
      this.triggerControlHaptic();
    });
    control.hitZone.on('pointerup', release);
    control.hitZone.on('pointerupoutside', release);
    control.hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) release(pointer);
    });
  }

  private bindTapControl(control: TouchControl, onPress: () => void): void {
    control.hitZone.on('pointerdown', () => {
      control.visual.setScale(0.9);
      onPress();
      this.triggerControlHaptic();
    });
    const release = (): void => {
      control.visual.setScale(1);
    };
    control.hitZone.on('pointerup', release);
    control.hitZone.on('pointerupoutside', release);
    control.hitZone.on('pointerout', release);
  }

  private releaseTouchPointer(pointerId: number): void {
    this.leftTouchPointers.delete(pointerId);
    this.rightTouchPointers.delete(pointerId);
    this.fireTouchPointers.delete(pointerId);
    this.coverTouchPointers.delete(pointerId);
  }

  private clearTouchControls(): void {
    this.leftTouchPointers.clear();
    this.rightTouchPointers.clear();
    this.fireTouchPointers.clear();
    this.coverTouchPointers.clear();
    this.leftPressed = false;
    this.rightPressed = false;
    this.firePressed = false;
    this.coverPressed = false;
    this.dragging = false;
    this.dragPointerId = null;
    this.player?.clearTarget();
  }

  private makeControlButton(x: number, y: number, symbol: string): TouchControl {
    const container = this.add.container(x, y).setDepth(30).setScrollFactor(0);
    const g = this.add.graphics();
    g.fillStyle(COLORS.yellow, 0.85);
    g.fillCircle(0, 0, 60);
    g.lineStyle(4, COLORS.white, 1);
    g.strokeCircle(0, 0, 60);
    const text = this.add
      .text(0, 0, symbol, { fontFamily: 'Arial Black', fontSize: '48px', color: COLORS_HEX.blue })
      .setOrigin(0.5);
    container.add([g, text]);
    container.setSize(156, 156);
    return {
      visual: container,
      hitZone: this.createTouchHitZone(x, y, 156),
    };
  }

  private makeFireButton(x: number, y: number): TouchControl {
    const container = this.add.container(x, y).setDepth(30).setScrollFactor(0);
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
    container.setSize(156, 156);

    this.tweens.add({
      targets: glow,
      scale: { from: 0.88, to: 1.08 },
      alpha: { from: 0.14, to: 0.36 },
      duration: 720,
      yoyo: true,
      repeat: -1,
    });
    return {
      visual: container,
      hitZone: this.createTouchHitZone(x, y, 156),
    };
  }

  private makeJumpButton(x: number, y: number): TouchControl {
    const container = this.add.container(x, y).setDepth(32).setScrollFactor(0);
    const glow = this.add.circle(0, 0, 53, COLORS.green, 0.2);
    const button = this.add
      .circle(0, 0, 47, COLORS.green, 0.96)
      .setStrokeStyle(4, COLORS.white, 1);
    const icon = this.add
      .text(0, -8, '↑', {
        fontFamily: 'Arial Black',
        fontSize: '43px',
        color: COLORS_HEX.white,
        stroke: '#06143a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 27, 'SALTO', {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: COLORS_HEX.yellow,
        stroke: '#06143a',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add([glow, button, icon, label]);
    container.setSize(108, 108);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.36 },
      scale: { from: 0.9, to: 1.08 },
      duration: 760,
      yoyo: true,
      repeat: -1,
    });
    return {
      visual: container,
      hitZone: this.createTouchHitZone(x, y, 108),
    };
  }

  private makeCoverButton(x: number, y: number): TouchControl {
    const container = this.add.container(x, y).setDepth(30).setScrollFactor(0);
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
    container.setSize(152, 152);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.34 },
      scale: { from: 0.9, to: 1.07 },
      duration: 820,
      yoyo: true,
      repeat: -1,
    });
    return {
      visual: container,
      hitZone: this.createTouchHitZone(x, y, 152),
    };
  }

  private createTouchHitZone(x: number, y: number, size: number): Phaser.GameObjects.Zone {
    // A Zone keeps its hit rectangle stable when Phaser scales and centres the
    // canvas. Container hit areas can become offset on some mobile browsers.
    return this.add
      .zone(x, y, size, size)
      .setOrigin(0.5)
      .setDepth(31)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
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
    this.startWorldTimers();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.onTick(),
    });

    // Arsenal drops continue during boss battles so the player can always
    // finish the fight even after exhausting the starting blaster.
    this.time.delayedCall(3200, () => this.spawnWeaponPickup());
    this.time.addEvent({
      delay: 12000,
      loop: true,
      callback: () => this.spawnWeaponPickup(),
    });
  }

  private startWorldTimers(): void {
    this.stopWorldTimers();
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      loop: true,
      callback: () => this.spawnItem(),
    });
    this.firstEnemyTimer = this.time.delayedCall(this.firstEnemyDelay, () => this.spawnEnemy());
    this.enemyTimer = this.time.addEvent({
      delay: this.enemySpawnDelay,
      loop: true,
      callback: () => this.spawnEnemy(),
    });
  }

  private stopWorldTimers(): void {
    this.spawnTimer?.remove();
    this.firstEnemyTimer?.remove();
    this.enemyTimer?.remove();
    this.spawnTimer = undefined;
    this.firstEnemyTimer = undefined;
    this.enemyTimer = undefined;
  }

  private showCountdownStart(): void {
    const label = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        `MUNDO 1\n${this.currentWorld.name.toUpperCase()}\n¡LISTO!`,
        {
        fontFamily: 'Arial Black',
        fontSize: '56px',
        color: this.currentWorld.colorHex,
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
        },
      )
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
    // Tweens own Daddy Pollo and both backgrounds during the cinematic.
    // Skipping regular gameplay prevents controls or collisions from
    // interrupting takeoff and landing.
    if (this.worldTransitioning) {
      return;
    }

    try {
      // A mobile browser can leave Arcade Physics paused after an interruption
      // without showing our pause overlay. Keep an active encounter moving.
      if (this.physics.world.isPaused) {
        this.physics.resume();
      }

      // Keyboard / touch movement.
      const left = this.leftPressed || this.leftTouchPointers.size > 0 || this.cursors?.left.isDown || this.keyA?.isDown;
      const right = this.rightPressed || this.rightTouchPointers.size > 0 || this.cursors?.right.isDown || this.keyD?.isDown;
      const wantsCover = Boolean(this.coverPressed || this.coverTouchPointers.size > 0 || this.keyS?.isDown || this.keyShift?.isDown);
      this.updateCover(wantsCover, delta);
      const keyboardJump =
        (this.cursors ? Phaser.Input.Keyboard.JustDown(this.cursors.up) : false) ||
        (this.keyW ? Phaser.Input.Keyboard.JustDown(this.keyW) : false);
      if (keyboardJump) {
        this.tryJump();
      }

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
    this.player.update(delta);

    const wantsToFire = this.firePressed || this.fireTouchPointers.size > 0 || this.keySpace?.isDown || this.keyF?.isDown;
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

    if (this.bossActive && this.boss.active) {
      try {
        const bossUpdate = this.boss.updateBoss(
          this.time.now,
          this.difficultySpeedMultiplier,
          delta,
        );
        if (bossUpdate.shouldAttack) {
          this.spawnBossAttack(bossUpdate.phase);
        }
        if (this.time.now >= this.nextBossReinforcementAt) {
          this.spawnEnemy(true);
          this.nextBossReinforcementAt =
            this.time.now + this.getBossReinforcementDelay();
        }
      } catch (error) {
        // One malformed pooled projectile must not abort Phaser's update loop.
        console.error('Se recuperó el ciclo de batalla del gran jefe.', error);
        this.cameras.main.resetFX();
        if (this.physics.world.isPaused) {
          this.physics.resume();
        }
      }
    }

    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) {
        return true;
      }
      // Boss hits are resolved manually instead of from an Arcade overlap
      // callback. This keeps damage deterministic and prevents a callback
      // exception from aborting Phaser's physics step on mobile browsers.
      if (
        this.bossActive &&
        this.boss.active &&
        this.projectileTouchesBoss(projectile)
      ) {
        this.onProjectileHitBoss(projectile, this.boss);
        return true;
      }
      if (
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

    this.bossProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (!projectile.active) {
        return true;
      }
      try {
        const body = projectile.body as Phaser.Physics.Arcade.Body | null;
        if (!body || !body.enable) {
          projectile.setActive(false).setVisible(false);
          return true;
        }
        const curve = Number(projectile.getData('curve') ?? 0);
        if (curve !== 0) {
          body.velocity.x += curve * (delta / 1000);
        }
        if (
          projectile.y > GAME_HEIGHT - 104 ||
          projectile.x < -90 ||
          projectile.x > GAME_WIDTH + 90
        ) {
          this.recycleEnemyProjectile(projectile);
        }
      } catch (error) {
        console.error('Se recicló un ataque inválido del gran jefe.', error);
        projectile.setActive(false).setVisible(false);
      }
      return true;
    });

      this.updatePowersExpiry();
    } catch (error) {
      // Phaser's RAF scheduler stops requesting frames after an uncaught
      // exception. Never let one optional object or effect freeze the canvas.
      console.error('Se recuperó un cuadro del juego sin detener la partida.', error);
      this.cameras.main.resetFX();
      if (!this.paused && this.physics.world.isPaused) {
        this.physics.resume();
      }
    }
  }

  private onTick(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    this.campaignElapsedSeconds += 1;
    if (this.bossActive) {
      this.timeText.setText('JEFE').setColor(this.currentWorld.colorHex);
      return;
    }
    if (this.worldTransitioning) {
      return;
    }
    this.timeLeft -= 1;
    this.timeText.setText(String(Math.max(0, this.timeLeft)));

    if (this.timeLeft <= 5 && this.timeLeft > 0) {
      audioManager.play('countdown');
      this.timeText.setColor(COLORS_HEX.red);
      this.tweens.add({ targets: this.timeText, scale: 1.3, duration: 120, yoyo: true });
    }

    const worldDuration = this.getBossArrivalSeconds();
    const nextStage = this.timeLeft <= worldDuration / 3
      ? 2
      : this.timeLeft <= (worldDuration * 2) / 3
        ? 1
        : 0;
    if (nextStage > this.worldPaceStage) {
      this.worldPaceStage = nextStage;
      this.refreshWorldPace();
      this.startWorldTimers();
    }

    if (this.timeLeft <= 0) {
      this.startBossBattle();
    }
  }

  private startBossBattle(): void {
    if (this.bossActive || this.worldTransitioning || this.gameOver) {
      return;
    }
    this.worldTransitioning = true;
    this.stopWorldTimers();
    if (this.physics.world.isPaused) {
      this.physics.resume();
    }

    // Arena cleanup is cosmetic. A malformed pooled object must never prevent
    // the configured boss encounter from starting.
    try {
      this.clearArenaForBoss();
    } catch (error) {
      console.error('No se pudo limpiar por completo la arena del jefe.', error);
    }

    this.timeText.setText('JEFE').setColor(this.currentWorld.colorHex);
    this.comboText.setVisible(false);
    this.powerText.setVisible(false);
    this.bossNameText
      .setText(`⚠ ${this.currentWorld.bossName.toUpperCase()} ⚠  •  VIDA 100%`)
      .setColor(this.currentWorld.colorHex)
      .setVisible(true);
    this.bossHealthBg.setVisible(true);
    this.bossHealthFill
      .setFillStyle(this.currentWorld.color, 1)
      .setScale(1, 1)
      .setVisible(true);

    // The player must never enter a boss fight unable to shoot. Preserve the
    // weapon they earned and refill it; use the starter blaster as fallback.
    if (this.activeWeapon) {
      this.weaponAmmo = Math.max(this.weaponAmmo, WEAPONS[this.activeWeapon].ammo);
    } else {
      this.equipStartingWeapon();
    }
    this.updateHud();

    try {
      this.boss.spawn(this.currentWorld, this.time.now, this.difficultyLevel);
      const bossBody = this.boss.body as Phaser.Physics.Arcade.Body;
      bossBody.reset(GAME_WIDTH / 2, 325);
      bossBody.setVelocity(0, 0);
    } catch (error) {
      console.error('No se pudo iniciar el jefe; se reintentará.', error);
      this.bossActive = false;
      this.worldTransitioning = false;
      this.timeLeft = 2;
      this.timeText.setText('2').setColor(COLORS_HEX.yellow);
      this.bossNameText.setVisible(false);
      this.bossHealthBg.setVisible(false);
      this.bossHealthFill.setVisible(false);
      this.comboText.setVisible(true);
      this.powerText.setVisible(true);
      this.startWorldTimers();
      return;
    }

    this.bossActive = true;
    this.worldTransitioning = false;
    this.nextBossReinforcementAt =
      this.time.now + Math.max(2400, this.getBossReinforcementDelay() * 0.58);
    this.cameras.main.resetFX();
    this.cameras.main.shake(260, 0.008);
    audioManager.play('blast');

    const warning = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `¡GRAN JEFE!\n${this.currentWorld.bossName}`, {
        fontFamily: 'Arial Black',
        fontSize: '58px',
        color: this.currentWorld.colorHex,
        stroke: '#020718',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({
      targets: warning,
      scale: { from: 0.72, to: 1.06 },
      alpha: { from: 1, to: 0 },
      duration: 900,
      hold: 250,
      ease: 'Cubic.out',
      onComplete: () => warning.destroy(),
    });
  }

  private clearArenaForBoss(): void {
    this.items.children.each((child) => {
      const item = child as FallingItem;
      if (item.active) item.recycle();
      return true;
    });
    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (enemy.active) enemy.recycle();
      return true;
    });
    this.enemyProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) this.recycleEnemyProjectile(projectile);
      return true;
    });
  }

  private spawnBossAttack(phase: number): void {
    const world = this.currentWorld;
    this.boss.playAttackMotion(this.time.now);
    const difficultyProjectiles = Math.floor(this.difficultyLevel / 4);
    const count = Math.min(
      9,
      1 + world.id + difficultyProjectiles + (phase >= 2 ? 1 : 0),
    );
    const baseAngle = Phaser.Math.Angle.Between(
      this.boss.x,
      this.boss.y + 35,
      this.player.x,
      this.player.y - 45,
    );
    const spread = world.id === 1 ? 0.55 : 0.82 + world.id * 0.08;
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : Phaser.Math.Linear(-spread / 2, spread / 2, index / (count - 1));
      try {
        this.spawnBossProjectile(baseAngle + offset, phase, index);
      } catch (error) {
        console.error('Se omitió un proyectil inválido del gran jefe.', error);
      }
    }
    try {
      this.emitMuzzleFlash(this.boss.x, this.boss.y + 60, world.color);
      this.tweens.add({
        targets: this.boss,
        scaleX: this.boss.scaleX * 1.08,
        scaleY: this.boss.scaleY * 0.94,
        duration: 90,
        yoyo: true,
      });
    } catch (error) {
      console.error('Se omitió un efecto visual del gran jefe.', error);
    }
    audioManager.play(world.id === 2 ? 'blast' : 'enemy');
  }

  private spawnBossProjectile(angle: number, phase: number, patternIndex: number): void {
    const world = this.currentWorld;
    const useMaliciousIcon = (this.bossProjectileIndex + patternIndex) % 3 !== 2;
    const texture = useMaliciousIcon
      ? BAD_ITEMS[(this.bossProjectileIndex + patternIndex) % BAD_ITEMS.length].key
      : world.projectileTexture;
    this.bossProjectileIndex += 1;
    const projectile = this.bossProjectiles.get(
      this.boss.x,
      this.boss.y + 60,
      texture,
    ) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) {
      return;
    }

    const size = useMaliciousIcon ? 48 + world.id * 2 : 42 + world.id * 2;
    projectile
      .setTexture(texture)
      .setActive(true)
      .setVisible(true)
      .setPosition(this.boss.x, this.boss.y + 60)
      .setDisplaySize(size, size)
      .setDepth(18)
      .setAlpha(1)
      .setTint(useMaliciousIcon ? 0xff647c : 0xffffff)
      .setData('bossProjectile', true)
      .setData('bossName', world.bossName)
      .setData('curve', world.id >= 4 ? (patternIndex % 2 === 0 ? 34 : -34) : 0);
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(projectile.x, projectile.y);
    body.setAllowGravity(false);
    body.setCircle(projectile.width * 0.37);
    const speed = world.projectileSpeed * this.difficultySpeedMultiplier * (1 + (phase - 1) * 0.1);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    projectile.setAngularVelocity((patternIndex % 2 === 0 ? 1 : -1) * (150 + world.id * 35));
  }

  private onProjectileHitBoss(projectile: Phaser.Physics.Arcade.Image, boss: Boss): void {
    if (!projectile.active || !boss.active || !this.bossActive) {
      return;
    }
    const weaponType = projectile.getData('weapon') as WeaponType;
    const weapon = WEAPONS[weaponType];
    if (!weapon) {
      console.error('Se descartó un disparo sin tipo de arma válido.');
      this.recycleProjectile(projectile);
      return;
    }
    const damage = weaponType === 'historic' ? 3 : weaponType === 'poseidon' ? 2 : 1;
    this.recycleProjectile(projectile);
    const defeated = boss.takeHit(damage);
    const remainingPercent = Math.max(0, Math.ceil(boss.healthRatio * 100));
    this.bossHealthFill.setScale(boss.healthRatio, 1);
    this.bossNameText.setText(
      `⚠ ${this.currentWorld.bossName.toUpperCase()} ⚠  •  VIDA ${remainingPercent}%`,
    );

    try {
      this.emitSparkle(projectile.x, projectile.y, weapon.color);
      audioManager.play('shot');
    } catch (error) {
      console.error('Se omitió un efecto visual de daño al jefe.', error);
    }
    if (defeated) {
      this.defeatBoss();
    }
  }

  private projectileTouchesBoss(projectile: Phaser.Physics.Arcade.Image): boolean {
    const horizontalRadius = Math.max(86, this.boss.displayWidth * 0.39);
    const verticalRadius = Math.max(120, this.boss.displayHeight * 0.43);
    return (
      Math.abs(projectile.x - this.boss.x) <= horizontalRadius &&
      Math.abs(projectile.y - this.boss.y) <= verticalRadius
    );
  }

  private defeatBoss(): void {
    if (!this.bossActive) {
      return;
    }
    const defeatedWorld = this.currentWorld;
    this.bossActive = false;
    this.worldTransitioning = true;
    this.bossHealthFill.setScale(0, 1);
    this.bossNameText.setText('¡JEFE DERROTADO!  •  VIDA 0%').setColor(COLORS_HEX.yellow);
    const bossBody = this.boss.body as Phaser.Physics.Arcade.Body | null;
    if (bossBody) {
      bossBody.enable = false;
      bossBody.setVelocity(0, 0);
    }
    this.boss.hideAnimatedParts();
    this.boss.setActive(false);
    this.bossProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) this.recycleEnemyProjectile(projectile);
      return true;
    });
    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (enemy.active) enemy.recycle();
      return true;
    });

    const awardedPoints = this.adjustPointsForDifficulty(defeatedWorld.bossPoints);
    this.score += awardedPoints;
    this.updateHud();

    // Schedule progression before optional effects. Even if a renderer rejects
    // an effect, the game still advances to the next world or final result.
    if (this.currentWorldIndex >= WORLDS.length - 1) {
      this.time.delayedCall(1850, () => this.finishCampaign());
    } else {
      this.time.delayedCall(1900, () => this.advanceToNextWorld());
    }

    try {
      this.showFloatingText(this.boss.x, this.boss.y, `+${awardedPoints} • JEFE`, COLORS_HEX.yellow);
      this.emitShockwave(this.boss.x, this.boss.y, 240, defeatedWorld.color);
      this.cameras.main.shake(650, 0.022);
      audioManager.play('combo');
      this.tweens.add({
        targets: this.boss,
        alpha: 0,
        angle: 24,
        scaleX: this.boss.scaleX * 1.45,
        scaleY: this.boss.scaleY * 1.45,
        duration: 780,
        ease: 'Cubic.in',
        onComplete: () => this.boss.recycle(),
      });
    } catch (error) {
      console.error('Se omitió un efecto de derrota; la campaña continuará.', error);
      this.boss.recycle();
    }
  }

  private advanceToNextWorld(): void {
    const previousWorld = this.currentWorld;
    this.currentWorldIndex += 1;
    const nextWorld = this.currentWorld;
    this.worldPaceStage = 0;
    this.timeLeft = this.getBossArrivalSeconds();
    this.refreshWorldPace();
    this.transitionWorldBackground(nextWorld);
    this.bossNameText.setVisible(false);
    this.bossHealthBg.setVisible(false);
    this.bossHealthFill.setVisible(false);
    this.comboText.setVisible(true);
    this.powerText.setVisible(true);
    this.timeText.setText(String(this.timeLeft)).setColor(COLORS_HEX.yellow);
    this.lives = Math.min(this.config.startingLives, this.lives + 1);
    if (this.activeWeapon) {
      this.weaponAmmo = Math.max(this.weaponAmmo, WEAPONS[this.activeWeapon].ammo);
    } else {
      this.equipStartingWeapon();
    }
    this.updateHud();
    this.clearTouchControls();
    this.playWorldTransitionCinematic(previousWorld, nextWorld);
  }

  private playWorldTransitionCinematic(
    previousWorld: WorldDefinition,
    nextWorld: WorldDefinition,
  ): void {
    let completed = false;
    const hadShield = this.isPowerActive('shield');
    const groundY = GAME_HEIGHT - 150;
    const originalScaleX = this.player.scaleX;
    const originalScaleY = this.player.scaleY;

    const finishTransition = (): void => {
      if (completed) {
        return;
      }
      completed = true;
      this.tweens.killTweensOf(this.player);
      this.worldTransitionTrail?.destroy();
      this.worldTransitionTrail = undefined;
      this.worldTransitionOverlay?.destroy();
      this.worldTransitionOverlay = undefined;
      this.player
        .setPosition(Phaser.Math.Clamp(this.player.x, 110, GAME_WIDTH - 110), groundY)
        .setDepth(5);
      this.player.endCinematicFlight();
      if (hadShield && this.isPowerActive('shield')) {
        this.player.showShield();
      }
      this.equippedWeaponSprite?.setVisible(true);
      this.worldTransitioning = false;
      this.startWorldTimers();
      this.spawnWeaponPickup();
      this.updateEquippedWeaponSprite();
    };

    try {
      this.worldTransitionOverlay?.destroy();
      this.worldTransitionTrail?.destroy();
      this.tweens.killTweensOf(this.player);
      this.player.beginCinematicFlight();
      this.player
        .setPosition(this.player.x, groundY)
        .setAngle(0)
        .setAlpha(1)
        .setDepth(75);
      this.equippedWeaponSprite?.setVisible(false);

      const previousTexture = this.textures.exists(previousWorld.backgroundKey)
        ? previousWorld.backgroundKey
        : 'fondo-los-cabos';
      const nextTexture = this.textures.exists(nextWorld.backgroundKey)
        ? nextWorld.backgroundKey
        : previousTexture;
      const overlay = this.add.container(0, 0).setDepth(60).setAlpha(0);
      this.worldTransitionOverlay = overlay;

      const outgoing = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, previousTexture)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      const incoming = this.add
        .image(GAME_WIDTH * 1.5, GAME_HEIGHT / 2, nextTexture)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      const colorWash = this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, previousWorld.color, 0.13)
        .setOrigin(0);
      const vignette = this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020718, 0.18)
        .setOrigin(0);
      const landingLine = this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 126, GAME_WIDTH, 9, nextWorld.color, 0)
        .setStrokeStyle(2, COLORS.white, 0);
      const landingGlow = this.add
        .ellipse(GAME_WIDTH / 2, groundY + 18, 210, 54, nextWorld.color, 0)
        .setStrokeStyle(5, COLORS.white, 0);

      overlay.add([outgoing, incoming, colorWash, vignette]);

      for (let index = 0; index < 18; index += 1) {
        const width = 45 + (index % 5) * 24;
        const streak = this.add
          .rectangle(
            GAME_WIDTH + Phaser.Math.Between(20, 420),
            Phaser.Math.Between(210, GAME_HEIGHT - 210),
            width,
            index % 3 === 0 ? 4 : 2,
            index % 2 === 0 ? previousWorld.color : nextWorld.color,
            0,
          )
          .setOrigin(0, 0.5);
        overlay.add(streak);
        this.tweens.add({
          targets: streak,
          x: -width - 80,
          alpha: { from: 0, to: 0.82 },
          duration: 760 + (index % 6) * 95,
          delay: 620 + index * 35,
          repeat: 2,
          ease: 'Linear',
        });
      }

      const topBar = this.add
        .rectangle(0, 0, GAME_WIDTH, 126, 0x020718, 0.94)
        .setOrigin(0);
      const bottomBar = this.add
        .rectangle(0, GAME_HEIGHT - 142, GAME_WIDTH, 142, 0x020718, 0.94)
        .setOrigin(0);
      const chapter = this.add
        .text(GAME_WIDTH / 2, 48, `MUNDO ${previousWorld.id} SUPERADO`, {
          fontFamily: 'Arial Black',
          fontSize: '21px',
          color: COLORS_HEX.yellow,
          letterSpacing: 2,
        })
        .setOrigin(0.5);
      const destination = this.add
        .text(
          GAME_WIDTH / 2,
          86,
          `${previousWorld.name.toUpperCase()}  →  ${nextWorld.name.toUpperCase()}`,
          {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#020718',
            strokeThickness: 4,
          },
        )
        .setOrigin(0.5);
      const route = WORLDS.map((world) => {
        if (world.id < nextWorld.id) return '●';
        if (world.id === nextWorld.id) return '◉';
        return '○';
      }).join('  ');
      const routeText = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 92, route, {
          fontFamily: 'Arial Black',
          fontSize: '29px',
          color: nextWorld.colorHex,
          stroke: '#020718',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      const flightLabel = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 45, 'DADDY POLLO EN RUTA', {
          fontFamily: 'Arial Black',
          fontSize: '16px',
          color: '#ffffff',
          letterSpacing: 3,
        })
        .setOrigin(0.5);
      overlay.add([
        landingLine,
        landingGlow,
        topBar,
        bottomBar,
        chapter,
        destination,
        routeText,
        flightLabel,
      ]);

      this.worldTransitionTrail = this.add
        .particles(0, 0, '__WHITE', {
          follow: this.player,
          lifespan: { min: 260, max: 520 },
          frequency: 24,
          speedX: { min: -150, max: -45 },
          speedY: { min: -28, max: 28 },
          scale: { start: 0.42, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: [COLORS.yellow, previousWorld.color, nextWorld.color, 0xffffff],
          blendMode: 'ADD',
        })
        .setDepth(72);

      this.tweens.add({
        targets: overlay,
        alpha: 1,
        duration: 260,
        ease: 'Sine.out',
      });
      audioManager.play('power');

      this.tweens.add({
        targets: this.player,
        x: GAME_WIDTH * 0.28,
        y: GAME_HEIGHT * 0.43,
        angle: -14,
        scaleX: originalScaleX * 0.86,
        scaleY: originalScaleY * 0.86,
        duration: 820,
        delay: 180,
        ease: 'Back.in',
        onComplete: () => {
          flightLabel.setText(`VOLANDO AL MUNDO ${nextWorld.id}`);
          this.tweens.add({
            targets: [outgoing, incoming],
            x: `-=${GAME_WIDTH}`,
            duration: 1480,
            ease: 'Cubic.inOut',
            onUpdate: (_tween, target: Phaser.GameObjects.Image) => {
              const progress = Phaser.Math.Clamp(
                (GAME_WIDTH / 2 - outgoing.x) / GAME_WIDTH,
                0,
                1,
              );
              colorWash.setFillStyle(
                Phaser.Display.Color.Interpolate.ColorWithColor(
                  Phaser.Display.Color.ValueToColor(previousWorld.color),
                  Phaser.Display.Color.ValueToColor(nextWorld.color),
                  100,
                  Math.round(progress * 100),
                ).color,
                0.13,
              );
              void target;
            },
            onComplete: () => {
              destination.setText(
                `MUNDO ${nextWorld.id}  •  ${nextWorld.name.toUpperCase()}`,
              );
              flightLabel.setText(nextWorld.subtitle.toUpperCase());
              landingLine.setFillStyle(nextWorld.color, 0.95);
              landingLine.setStrokeStyle(2, COLORS.white, 0.72);
              landingGlow.setFillStyle(nextWorld.color, 0.34);
              landingGlow.setStrokeStyle(5, COLORS.white, 0.68);
              this.tweens.add({
                targets: landingGlow,
                scaleX: { from: 0.25, to: 1.25 },
                alpha: { from: 0, to: 0.72 },
                duration: 720,
                ease: 'Cubic.out',
              });
              this.tweens.add({
                targets: this.player,
                x: GAME_WIDTH / 2,
                y: groundY,
                angle: 0,
                scaleX: originalScaleX,
                scaleY: originalScaleY,
                duration: 980,
                ease: 'Bounce.out',
                onComplete: () => {
                  audioManager.play('catch');
                  this.cameras.main.shake(180, 0.008);
                  this.cameras.main.flash(220, 255, 255, 255, false);
                  this.worldTransitionTrail?.stop();
                  this.player.endCinematicFlight();
                  if (hadShield && this.isPowerActive('shield')) {
                    this.player.showShield();
                  }
                  this.equippedWeaponSprite?.setVisible(true);
                  flightLabel.setText('¡ATERRIZAJE COMPLETADO!');
                  this.tweens.add({
                    targets: overlay,
                    alpha: 0,
                    duration: 420,
                    delay: 360,
                    ease: 'Sine.in',
                    onComplete: finishTransition,
                  });
                },
              });
            },
          });
          this.tweens.add({
            targets: this.player,
            x: GAME_WIDTH * 0.76,
            y: GAME_HEIGHT * 0.27,
            angle: 13,
            scaleX: originalScaleX * 0.72,
            scaleY: originalScaleY * 0.72,
            duration: 1480,
            ease: 'Sine.inOut',
          });
        },
      });

      // A renderer interruption must never leave campaign progression locked.
      this.time.delayedCall(6200, finishTransition);
    } catch (error) {
      console.error('Se omitió la cinemática entre mundos; la campaña continuará.', error);
      finishTransition();
    }
  }

  private finishCampaign(): void {
    const finale = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '¡CAMPAÑA COMPLETA!\nVENCISTE A LOS 5 JEFES', {
        fontFamily: 'Arial Black',
        fontSize: '55px',
        color: COLORS_HEX.yellow,
        stroke: '#020718',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: finale,
      scale: { from: 0.4, to: 1.05 },
      duration: 650,
      ease: 'Back.out',
    });
    this.time.delayedCall(1700, () => {
      finale.destroy();
      this.endGame();
    });
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------

  private spawnItem(): void {
    if (this.paused || this.gameOver || this.bossActive || this.worldTransitioning) {
      return;
    }
    const definition = this.pickItem();
    this.spawnDefinition(definition);
  }

  private spawnWeaponPickup(): void {
    if (this.paused || this.gameOver || this.worldTransitioning) {
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

  private getBossReinforcementDelay(): number {
    const difficultyReduction = this.difficultyLevel * 420;
    const worldReduction = this.currentWorld.id * 260;
    return Phaser.Math.Clamp(
      9200 - difficultyReduction - worldReduction,
      3200,
      8500,
    );
  }

  private spawnEnemy(bossSupport = false): void {
    if (
      this.paused ||
      this.gameOver ||
      (this.bossActive && !bossSupport) ||
      this.worldTransitioning ||
      this.enemies.countActive(true) >= this.maxActiveEnemies
    ) {
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
    const y = bossSupport ? 470 + orderIndex * 105 : 350 + orderIndex * 118;
    this.enemySpawnId += 1;
    enemy.spawn(type, x, y, this.time.now, this.enemySpawnId);

    const definition = ENEMIES[type];
    const notice = this.add
      .text(
        GAME_WIDTH / 2,
        292,
        bossSupport ? `⚠ REFUERZOS DEL JEFE • ${definition.label}` : `⚠ ${definition.label}`,
        {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: definition.colorHex,
        stroke: '#020718',
        strokeThickness: 6,
        },
      )
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

  private equipStartingWeapon(): void {
    const definition = WEAPONS.modern;
    this.activeWeapon = 'modern';
    this.weaponAmmo = definition.ammo;
    this.nextShotAt = 0;
    // The modern blaster is already equipped, so the first falling weapon is
    // the historic cannon instead of a duplicate pickup.
    this.nextWeaponIndex = 1;
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = undefined;
    this.player.setIntegratedBlaster(true);
    this.updateHud();

    const hint = this.add
      .text(GAME_WIDTH / 2, 318, 'BLÁSTER LISTO  •  MANTÉN FUEGO', {
        fontFamily: 'Arial Black',
        fontSize: '21px',
        color: definition.colorHex,
        stroke: '#020718',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(44);
    this.tweens.add({
      targets: hint,
      y: 294,
      alpha: { from: 1, to: 0 },
      duration: 1800,
      hold: 800,
      ease: 'Cubic.out',
      onComplete: () => hint.destroy(),
    });
  }

  private handleWeaponCatch(weapon: WeaponType, x: number, y: number): void {
    const definition = WEAPONS[weapon];
    this.activeWeapon = weapon;
    this.weaponAmmo = definition.ammo;
    this.nextShotAt = this.time.now + 180;
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = undefined;
    this.player.setIntegratedBlaster(weapon === 'modern');
    if (!this.player.hasIntegratedBlaster()) {
      const displaySize = weapon === 'poseidon' ? 72 : 62;
      this.equippedWeaponSprite = this.add
        .image(this.player.x + 36, this.player.y - 78, definition.textureKey)
        .setDisplaySize(displaySize, displaySize)
        .setOrigin(0.28, 0.72)
        .setDepth(9);
    }

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
    if (this.player.isJumping()) {
      requested = false;
    }
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
    const type = projectile.getData('enemyType') as EnemyType | undefined;
    const bossProjectile = Boolean(projectile.getData('bossProjectile'));
    const attackerName = bossProjectile
      ? String(projectile.getData('bossName') ?? 'GRAN JEFE')
      : type
        ? ENEMIES[type].label
        : 'RIVAL';
    this.recycleEnemyProjectile(projectile);

    if (this.isPowerActive('shield') || this.player.isCovering()) {
      if (!this.isPowerActive('shield')) {
        this.coverEnergy = Math.max(0, this.coverEnergy - (bossProjectile ? 24 : 16));
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
      `-${attackerName} • 1 VIDA`,
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
    projectile.setActive(false).setVisible(false).clearTint();
    projectile.setData('bossProjectile', false).setData('curve', 0);
  }

  private tryFireWeapon(fromFreshPress = false): void {
    if (this.paused || this.gameOver || this.worldTransitioning) {
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
    // Holding FIRE still respects each weapon's automatic cadence. A fresh
    // click/tap is never thrown away merely because it landed a few
    // milliseconds before the cooldown ended.
    if (!fromFreshPress && this.time.now < this.nextShotAt) {
      return;
    }
    this.nextShotAt = this.time.now + weapon.cooldownMs;

    const facing = this.player.getFacingDirection();
    const integratedBlaster = this.player.hasIntegratedBlaster();
    const muzzleX = this.player.x + (integratedBlaster ? 58 : 76) * facing;
    const muzzleY = this.player.y - (integratedBlaster ? 94 : 99);
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

  private tryJump(): void {
    if (
      this.paused ||
      this.gameOver ||
      this.worldTransitioning ||
      this.player.isCovering()
    ) {
      return;
    }
    if (this.player.jump()) {
      this.showFloatingText(this.player.x, this.player.y - 120, '¡SALTO!', COLORS_HEX.neon);
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
    if (this.bossActive && !this.gameOver) {
      // Boss battles always remain winnable. Special weapons fall back to a
      // fully loaded integrated blaster instead of leaving the player idle.
      this.equipStartingWeapon();
      return;
    }
    this.activeWeapon = null;
    this.equippedWeaponSprite?.destroy();
    this.equippedWeaponSprite = undefined;
    this.player.setIntegratedBlaster(false);
    this.updateHud();
  }

  private updateEquippedWeaponSprite(): void {
    if (!this.equippedWeaponSprite || !this.activeWeapon) {
      return;
    }
    const gait = Math.sin(this.time.now * 0.026);
    const bob = Math.max(0, gait) * -4 + Math.sin(this.time.now * 0.009) * 1.2;
    const facing = this.player.getFacingDirection();
    this.equippedWeaponSprite
      .setPosition(this.player.x + 34 * facing, this.player.y - 79 + bob)
      .setFlipX(facing < 0)
      .setAngle((this.activeWeapon === 'poseidon' ? -10 : -5) * facing);
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
    this.worldText
      .setText(`MUNDO ${this.currentWorld.id}/5  •  ${this.currentWorld.name.toUpperCase()}`)
      .setColor(this.currentWorld.colorHex);
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

  private triggerControlHaptic(): void {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(18);
      } catch {
        // Vibration is optional and may be blocked by the device.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pause / end
  // ---------------------------------------------------------------------------

  private togglePause(): void {
    if (this.gameOver || this.worldTransitioning) {
      return;
    }
    this.paused = !this.paused;
    if (this.paused) {
      this.clearTouchControls();
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
    audioManager.play('win');

    const result: GameResult = {
      score: this.score,
      caughtItems: this.caughtItems,
      missedItems: this.missedItems,
      livesRemaining: Math.max(0, this.lives),
      durationSeconds: Math.max(1, this.campaignElapsedSeconds),
      selectedBranch: (this.registry.get(REGISTRY.selectedBranch) as string) ?? 'auroras',
      clientSessionId: generateUuid(),
    };
    this.registry.set(REGISTRY.lastResult, result);

    // Queue only the scene change from inside the collision callback. Phaser
    // will stop timers, input and physics in its own safe shutdown order.
    this.scene.start(SCENES.Result);
  }

  private cleanup(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }

    // SHUTDOWN listeners from Arcade Physics and the Scene Clock run before
    // this callback. Do not call methods on bodies, timers or display objects
    // here: they may already be destroyed. Phaser owns their disposal.
    this.spawnTimer = undefined;
    this.firstEnemyTimer = undefined;
    this.enemyTimer = undefined;
    this.leftTouchPointers.clear();
    this.rightTouchPointers.clear();
    this.fireTouchPointers.clear();
    this.coverTouchPointers.clear();
    this.dragPointerId = null;
    this.pauseOverlay = undefined;
    this.equippedWeaponSprite = undefined;
    this.worldTransitionOverlay = undefined;
    this.worldTransitionTrail = undefined;
  }
}
