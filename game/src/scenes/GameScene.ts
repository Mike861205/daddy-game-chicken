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
import { ENEMIES, getEnemyPoolForWorld, type EnemyType } from '../config/enemies.js';
import {
  GENERAL_TRIGGER_PROGRESS,
  getGeneralForWorld,
  type GeneralDefinition,
} from '../config/generals.js';
import { WEAPONS } from '../config/weapons.js';
import { WORLDS, type WorldDefinition } from '../config/worlds.js';
import {
  EMPTY_MEMBERSHIP,
  OUTFITS,
  PREMIUM_WEAPONS,
  hasActiveMembership,
  isOutfitAvailable,
  isEliteMembership,
  withLocalDevelopmentAccess,
  type MembershipEntitlement,
  type PremiumWeaponId,
} from '../config/memberships.js';
import { Boss } from '../objects/Boss.js';
import { CombatBike } from '../objects/CombatBike.js';
import { Enemy } from '../objects/Enemy.js';
import { FallingItem } from '../objects/FallingItem.js';
import { Player } from '../objects/Player.js';
import { WorldAmbience } from '../objects/WorldAmbience.js';
import { audioManager } from '../services/audio.js';
import { DEFAULT_CONFIG } from '../services/api.js';
import { removeRegistrationOverlays } from '../services/registrationForm.js';
import { storage } from '../services/storage.js';
import { generateUuid } from '../utils/uuid.js';
import type { GameResult, PublicConfig } from '../types.js';

interface TouchControl {
  visual: Phaser.GameObjects.Container;
  hitZone: Phaser.GameObjects.Zone;
}

interface VipAbilityControl {
  visual: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Arc;
  progress: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Arc;
  color: number;
  stateKey: string;
}

interface BossProjectileOptions {
  texture?: string;
  kind?: string;
  size?: number;
  displayWidth?: number;
  displayHeight?: number;
  speedMultiplier?: number;
  curve?: number;
  useMaliciousIcon?: boolean;
  originX?: number;
  originY?: number;
  angularVelocity?: number;
  baseSpeed?: number;
  attackerName?: string;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private boss!: Boss;
  private secondaryBoss!: Boss;
  private general!: Boss;
  private combatBike!: CombatBike;
  private config!: PublicConfig;
  private membership: MembershipEntitlement = { ...EMPTY_MEMBERSHIP };

  private score = 0;
  private lives = 3;
  private timeLeft = 60;
  private comboCount = 0;
  private caughtItems = 0;
  private missedItems = 0;
  private paused = false;
  private gameOver = false;
  private bossActive = false;
  private generalActive = false;
  private worldTransitioning = false;
  private currentWorldIndex = 0;
  private worldPaceStage = 0;
  private campaignElapsedSeconds = 0;
  private bossProjectileIndex = 0;
  private bossAttackSequence = 0;
  private currentGeneral?: GeneralDefinition;
  private readonly defeatedGeneralWorlds = new Set<number>();

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
  private nextCombatBikeShotAt = 0;
  private premiumWeaponActiveUntil = 0;
  private premiumWeaponUsedWorlds = new Set<number>();
  private premiumPlaneUsedWorlds = new Set<number>();
  private elitePowerUsedWorlds = new Set<number>();
  private elitePowerCharge = 25;
  private premiumPlane?: Phaser.GameObjects.Container;
  private premiumPlaneExpiresAt = 0;
  private nextPremiumPlaneShotAt = 0;
  private premiumWeaponControl?: VipAbilityControl;
  private premiumPlaneControl?: VipAbilityControl;
  private elitePowerControl?: VipAbilityControl;

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
  private backgroundImage?: Phaser.GameObjects.Image;
  private worldColorOverlay?: Phaser.GameObjects.Rectangle;
  private worldTransitionOverlay?: Phaser.GameObjects.Container;
  private worldTransitionTrail?: Phaser.GameObjects.Particles.ParticleEmitter;
  private worldAmbience?: WorldAmbience;

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
  private keyOne?: Phaser.Input.Keyboard.Key;
  private keyTwo?: Phaser.Input.Keyboard.Key;
  private keyThree?: Phaser.Input.Keyboard.Key;

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
    this.membership = withLocalDevelopmentAccess(
      (this.registry.get(REGISTRY.membership) as MembershipEntitlement | undefined)
      ?? storage.getMembership()
      ?? { ...EMPTY_MEMBERSHIP },
    );
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
    this.createMembershipControls();
    this.createMembershipIdentity();
    this.createKeyboardControls();
    this.createPauseButton();
    this.setupVisibilityPause();

    if (hasActiveMembership(this.membership)) {
      this.time.delayedCall(3250, () => {
        if (!this.scene.isActive()) return;
        this.startTimers();
        this.showCountdownStart();
      });
    } else {
      this.startTimers();
      this.showCountdownStart();
    }

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
    this.generalActive = false;
    this.worldTransitioning = false;
    this.currentWorldIndex = 0;
    this.worldPaceStage = 0;
    this.campaignElapsedSeconds = 0;
    this.bossProjectileIndex = 0;
    this.bossAttackSequence = 0;
    this.currentGeneral = undefined;
    this.defeatedGeneralWorlds.clear();
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
    this.nextCombatBikeShotAt = 0;
    this.premiumWeaponActiveUntil = 0;
    this.premiumWeaponUsedWorlds.clear();
    this.premiumPlaneUsedWorlds.clear();
    this.elitePowerUsedWorlds.clear();
    this.elitePowerCharge = import.meta.env.DEV ? 100 : 25;
    this.premiumPlaneExpiresAt = 0;
    this.nextPremiumPlaneShotAt = 0;
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
    const baseEnemySpawnDelay = 9000 * (1 - 0.35 * offset);
    this.enemySpawnDelay = Math.max(
      4300,
      Math.round(baseEnemySpawnDelay * (1 - worldBoost * 0.28 - stageBoost * 0.18)),
    );
    this.firstEnemyDelay = Math.max(
      2500,
      Math.round(
        4800 *
        (1 - 0.25 * offset) *
        (1 - worldBoost * 0.2 - stageBoost * 0.12),
      ),
    );
    const difficultyEnemyLimit =
      this.difficultyLevel <= 2 ? 1 : this.difficultyLevel >= 8 ? 3 : 2;
    this.maxActiveEnemies = Math.min(
      3,
      difficultyEnemyLimit + (this.currentWorldIndex >= 4 ? 1 : 0),
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
    this.prepareAnimatedBackground(this.backgroundImage);
    this.worldColorOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.currentWorld.color, 0.055)
      .setOrigin(0)
      .setDepth(0.5);

    this.worldAmbience = new WorldAmbience(this);
    this.worldAmbience.activate(this.currentWorld);

    // Ground line.
    const ground = this.add.graphics();
    ground.fillStyle(COLORS.yellow, 1);
    ground.fillRect(0, GAME_HEIGHT - 130, GAME_WIDTH, 8);
    ground.setDepth(3);
  }

  private prepareAnimatedBackground(image: Phaser.GameObjects.Image): void {
    image.setData('ambientBaseScaleX', image.scaleX);
    image.setData('ambientBaseScaleY', image.scaleY);
  }

  private updateBackgroundMotion(time: number): void {
    if (!this.backgroundImage?.active) {
      return;
    }
    const image = this.backgroundImage;
    const baseScaleX = Number(image.getData('ambientBaseScaleX')) || image.scaleX;
    const baseScaleY = Number(image.getData('ambientBaseScaleY')) || image.scaleY;
    const world = this.currentWorld.id;
    const phase = time * (world === 2 ? 0.00065 : 0.00042) + world * 0.73;
    const zoom = 1.035 + Math.sin(phase * 0.54) * 0.006;
    const horizontalDrift = world === 6 ? 4.2 : world === 8 ? 3.4 : 2.2;
    const verticalDrift = world === 1 || world === 2 || world === 3 ? 3.6 : 2.1;
    const rocking = world === 2 ? Math.sin(phase * 0.68) * 0.22 : 0;

    image
      .setPosition(
        GAME_WIDTH / 2 + Math.sin(phase) * horizontalDrift,
        GAME_HEIGHT / 2 + Math.cos(phase * 0.82) * verticalDrift,
      )
      .setScale(baseScaleX * zoom, baseScaleY * zoom)
      .setAngle(rocking);
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
    this.prepareAnimatedBackground(incoming);
    const outgoing = this.backgroundImage;
    this.backgroundImage = incoming;
    this.worldColorOverlay?.setFillStyle(world.color, 0.055);
    this.worldAmbience?.activate(world);
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
    const selectedOutfit = hasActiveMembership(this.membership)
      ? OUTFITS.find((outfit) => outfit.id === this.membership.selectedOutfit)
      : undefined;
    const outfitUnlocked =
      selectedOutfit
      && isOutfitAvailable(selectedOutfit.unlockWorld, storage.getMaxWorldUnlocked());
    this.player = new Player(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 150,
      outfitUnlocked ? selectedOutfit.textureKey : undefined,
    );
    this.player.setDepth(5);
    this.combatBike = new CombatBike(this);
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

    if (!this.textures.exists('bala-plasma-neon')) {
      const plasma = this.make.graphics({ x: 0, y: 0 }, false);
      plasma.fillStyle(0x21e6c1, 0.28);
      plasma.fillRoundedRect(0, 0, 24, 74, 12);
      plasma.fillStyle(0xffffff, 1);
      plasma.fillTriangle(12, 0, 2, 24, 22, 24);
      plasma.fillStyle(0x21e6c1, 1);
      plasma.fillRoundedRect(8, 18, 8, 52, 4);
      plasma.generateTexture('bala-plasma-neon', 24, 74);
      plasma.destroy();
    }

    if (!this.textures.exists('bala-misil-sabor')) {
      const missile = this.make.graphics({ x: 0, y: 0 }, false);
      missile.fillStyle(0xff7b24, 0.32);
      missile.fillEllipse(25, 32, 48, 62);
      missile.fillStyle(0xe6262b, 1);
      missile.fillRoundedRect(10, 8, 30, 47, 14);
      missile.fillStyle(0xffffff, 1);
      missile.fillTriangle(25, 0, 10, 20, 40, 20);
      missile.fillStyle(0xffd21e, 1);
      missile.fillTriangle(10, 48, 0, 64, 18, 57);
      missile.fillTriangle(40, 48, 50, 64, 32, 57);
      missile.generateTexture('bala-misil-sabor', 50, 68);
      missile.destroy();
    }

    if (!this.textures.exists('bala-rayo-vip')) {
      const ray = this.make.graphics({ x: 0, y: 0 }, false);
      ray.fillStyle(0x63e8ff, 0.3);
      ray.fillRoundedRect(0, 0, 30, 92, 14);
      ray.fillStyle(0xffffff, 1);
      ray.fillTriangle(15, 0, 5, 48, 17, 42);
      ray.fillTriangle(17, 38, 8, 92, 27, 32);
      ray.lineStyle(3, 0x63e8ff, 1);
      ray.strokeRoundedRect(2, 2, 26, 88, 12);
      ray.generateTexture('bala-rayo-vip', 30, 92);
      ray.destroy();
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

    if (!this.textures.exists('ataque-hielo')) {
      const ice = this.make.graphics({ x: 0, y: 0 }, false);
      ice.fillStyle(0x8ff7ff, 0.35);
      ice.fillCircle(26, 26, 25);
      ice.fillStyle(0xd9ffff, 1);
      ice.fillTriangle(26, 2, 42, 38, 26, 31);
      ice.fillTriangle(26, 2, 10, 38, 26, 31);
      ice.lineStyle(3, 0x26bfff, 1);
      ice.strokeTriangle(26, 2, 42, 38, 10, 38);
      ice.generateTexture('ataque-hielo', 52, 52);
      ice.destroy();
    }

    if (!this.textures.exists('ataque-metralla')) {
      const bullet = this.make.graphics({ x: 0, y: 0 }, false);
      bullet.fillStyle(0xffd45c, 0.28);
      bullet.fillRoundedRect(0, 6, 58, 10, 5);
      bullet.fillStyle(0xfff4b0, 1);
      bullet.fillRoundedRect(19, 7, 42, 8, 4);
      bullet.fillStyle(0xff8b2b, 1);
      bullet.fillTriangle(61, 7, 68, 11, 61, 15);
      bullet.generateTexture('ataque-metralla', 68, 22);
      bullet.destroy();
    }

    if (!this.textures.exists('ataque-flecha')) {
      const arrow = this.make.graphics({ x: 0, y: 0 }, false);
      arrow.fillStyle(0x43f4d2, 0.24);
      arrow.fillRoundedRect(0, 7, 64, 10, 5);
      arrow.fillStyle(0xffd86a, 1);
      arrow.fillRoundedRect(12, 10, 54, 4, 2);
      arrow.fillStyle(0x56e6cf, 1);
      arrow.fillTriangle(0, 4, 15, 12, 0, 20);
      arrow.fillStyle(0xfff2a6, 1);
      arrow.fillTriangle(58, 3, 76, 12, 58, 21);
      arrow.generateTexture('ataque-flecha', 76, 24);
      arrow.destroy();
    }

    if (!this.textures.exists('ataque-divino')) {
      const divine = this.make.graphics({ x: 0, y: 0 }, false);
      divine.fillStyle(0xd274ff, 0.25);
      divine.fillCircle(28, 28, 28);
      divine.lineStyle(4, 0xffd86a, 0.95);
      divine.strokeCircle(28, 28, 20);
      divine.lineStyle(3, 0xf5dcff, 0.9);
      divine.strokeCircle(28, 28, 12);
      divine.fillStyle(0xffffff, 1);
      divine.fillCircle(28, 28, 7);
      divine.fillStyle(0xffe982, 1);
      divine.fillTriangle(28, 1, 33, 18, 23, 18);
      divine.fillTriangle(28, 55, 23, 38, 33, 38);
      divine.generateTexture('ataque-divino', 56, 56);
      divine.destroy();
    }

    if (!this.textures.exists('ataque-cadena')) {
      const chainShot = this.make.graphics({ x: 0, y: 0 }, false);
      chainShot.fillStyle(0x60c8ff, 0.25);
      chainShot.fillCircle(36, 28, 26);
      chainShot.fillStyle(0x17233b, 1);
      chainShot.fillCircle(39, 28, 16);
      chainShot.lineStyle(4, 0xffd16a, 1);
      chainShot.strokeCircle(39, 28, 17);
      chainShot.lineStyle(5, 0xc8d8e8, 1);
      chainShot.lineBetween(2, 18, 25, 24);
      chainShot.lineBetween(2, 36, 25, 30);
      chainShot.fillStyle(0xffffff, 0.9);
      chainShot.fillCircle(34, 23, 5);
      chainShot.generateTexture('ataque-cadena', 64, 56);
      chainShot.destroy();
    }

    if (!this.textures.exists('ataque-toxico-general')) {
      const toxic = this.make.graphics({ x: 0, y: 0 }, false);
      toxic.fillStyle(0x9cff3d, 0.24);
      toxic.fillCircle(31, 31, 30);
      toxic.fillStyle(0x365d16, 1);
      toxic.fillCircle(31, 31, 21);
      toxic.lineStyle(4, 0xcfff72, 1);
      toxic.strokeCircle(31, 31, 22);
      toxic.fillStyle(0xe9ffb0, 1);
      toxic.fillCircle(24, 23, 7);
      toxic.fillCircle(40, 34, 5);
      toxic.fillStyle(0x17210f, 0.85);
      toxic.fillCircle(30, 40, 4);
      toxic.generateTexture('ataque-toxico-general', 62, 62);
      toxic.destroy();
    }

    if (!this.textures.exists('ataque-cosmico-general')) {
      const cosmic = this.make.graphics({ x: 0, y: 0 }, false);
      cosmic.fillStyle(0xc968ff, 0.24);
      cosmic.fillCircle(32, 32, 31);
      cosmic.lineStyle(4, 0x63e8ff, 0.95);
      cosmic.strokeCircle(32, 32, 24);
      cosmic.lineStyle(3, 0xf0c4ff, 0.9);
      cosmic.strokeCircle(32, 32, 15);
      cosmic.fillStyle(0x7d2fd6, 1);
      cosmic.fillCircle(32, 32, 13);
      cosmic.fillStyle(0xffffff, 1);
      cosmic.fillCircle(28, 27, 6);
      cosmic.fillStyle(0x77f4ff, 0.95);
      cosmic.fillTriangle(32, 0, 37, 18, 27, 18);
      cosmic.fillTriangle(32, 64, 27, 46, 37, 46);
      cosmic.generateTexture('ataque-cosmico-general', 64, 64);
      cosmic.destroy();
    }

    if (!this.textures.exists('ataque-atomico')) {
      const bomb = this.make.graphics({ x: 0, y: 0 }, false);
      bomb.fillStyle(0x1c2438, 1);
      bomb.fillEllipse(28, 35, 32, 46);
      bomb.fillStyle(0xffb21c, 1);
      bomb.fillCircle(28, 34, 12);
      bomb.fillStyle(0x141a29, 1);
      bomb.fillTriangle(18, 17, 8, 5, 23, 12);
      bomb.fillTriangle(38, 17, 48, 5, 33, 12);
      bomb.lineStyle(3, 0xffef73, 1);
      bomb.strokeCircle(28, 34, 12);
      bomb.generateTexture('ataque-atomico', 56, 62);
      bomb.destroy();
    }

    if (!this.textures.exists('ataque-rayo')) {
      const ray = this.make.graphics({ x: 0, y: 0 }, false);
      ray.fillStyle(0x9ffcff, 0.34);
      ray.fillRoundedRect(6, 0, 22, 76, 11);
      ray.fillStyle(0xffffff, 1);
      ray.fillTriangle(17, 0, 8, 43, 19, 39);
      ray.fillTriangle(19, 36, 12, 76, 28, 28);
      ray.lineStyle(2, 0x40dfff, 1);
      ray.strokeRoundedRect(7, 1, 20, 74, 10);
      ray.generateTexture('ataque-rayo', 34, 76);
      ray.destroy();
    }

    if (!this.textures.exists('ataque-alien')) {
      const alienBolt = this.make.graphics({ x: 0, y: 0 }, false);
      alienBolt.fillStyle(0xd778ff, 0.25);
      alienBolt.fillEllipse(16, 30, 30, 60);
      alienBolt.fillStyle(0xf4dcff, 1);
      alienBolt.fillEllipse(16, 30, 10, 52);
      alienBolt.lineStyle(3, 0x9d36ff, 1);
      alienBolt.strokeEllipse(16, 30, 22, 56);
      alienBolt.generateTexture('ataque-alien', 32, 60);
      alienBolt.destroy();
    }

    if (!this.textures.exists('mini-nave-alien')) {
      const fighter = this.make.graphics({ x: 0, y: 0 }, false);
      fighter.fillStyle(0x1b1236, 1);
      fighter.fillTriangle(32, 60, 4, 18, 60, 18);
      fighter.fillStyle(0xc865ff, 1);
      fighter.fillEllipse(32, 28, 26, 22);
      fighter.fillStyle(0x9dfcff, 1);
      fighter.fillCircle(32, 28, 7);
      fighter.lineStyle(3, 0xe7b5ff, 1);
      fighter.strokeTriangle(32, 60, 4, 18, 60, 18);
      fighter.generateTexture('mini-nave-alien', 64, 64);
      fighter.destroy();
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
      maxSize: 64,
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
    this.secondaryBoss = new Boss(this, GAME_WIDTH / 2, -180);
    this.general = new Boss(this, GAME_WIDTH / 2, -180);
    this.bossProjectiles = this.physics.add.group({
      maxSize: 140,
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
    this.keyOne = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE, false);
    this.keyTwo = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO, false);
    this.keyThree = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE, false);
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

  private getElitePowerTexture(): string {
    return [
      'poder-rayos-cielo',
      'poder-fuego-arrasador',
      'poder-terremoto-daddy',
    ][(this.currentWorld.id - 1) % 3];
  }

  private createMembershipControls(): void {
    if (!hasActiveMembership(this.membership)) {
      return;
    }
    const elite = isEliteMembership(this.membership);
    const x = GAME_WIDTH - 68;
    const weaponTexture: Record<PremiumWeaponId, string> = {
      'plasma-neon': 'vip-tridente-plasma',
      'misil-sabor': 'vip-misil-sabor',
      'rayo-poseidon': 'vip-rayo-poseidon',
    };
    if (elite) {
      this.premiumWeaponControl = this.makeVipAbilityButton(
        x,
        GAME_HEIGHT - 490,
        weaponTexture[this.membership.selectedWeapon],
        'ARMA VIP',
        '1',
        0x8c35d8,
        () => this.activatePremiumWeapon(),
      );
      this.elitePowerControl = this.makeVipAbilityButton(
        x,
        GAME_HEIGHT - 350,
        this.getElitePowerTexture(),
        'PODER',
        '2',
        0xe6262b,
        () => this.activateElitePower(),
      );
      this.premiumPlaneControl = this.makeVipAbilityButton(
        x,
        GAME_HEIGHT - 210,
        'avion-daddy',
        'AVIÓN',
        '3',
        0x1450c8,
        () => this.activatePremiumPlane(),
      );
    } else {
      this.premiumWeaponControl = this.makeVipAbilityButton(
        x,
        GAME_HEIGHT - 390,
        weaponTexture[this.membership.selectedWeapon],
        'ARMA VIP',
        '1',
        0x8c35d8,
        () => this.activatePremiumWeapon(),
      );
      this.premiumPlaneControl = this.makeVipAbilityButton(
        x,
        GAME_HEIGHT - 230,
        'avion-daddy',
        'AVIÓN',
        '3',
        0x1450c8,
        () => this.activatePremiumPlane(),
      );
    }
    this.updateMembershipControls();
  }

  private createMembershipIdentity(): void {
    if (!hasActiveMembership(this.membership)) return;
    const elite = isEliteMembership(this.membership);
    const accent = elite ? 0xbda7ff : COLORS.yellow;
    const icon = elite ? '◆' : '★';
    const planLabel = elite ? 'DADDY ELITE' : 'DADDY PLUS';

    const badge = this.add.container(GAME_WIDTH - 24, 92).setDepth(44).setScrollFactor(0);
    const badgeBg = this.add
      .rectangle(0, 0, 188, 38, elite ? 0x552aa8 : 0x805a00, 0.96)
      .setOrigin(1, 0.5)
      .setStrokeStyle(2, accent, 1);
    const badgeText = this.add
      .text(-12, 0, `${icon} ${planLabel}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#020718',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);
    badge.add([badgeBg, badgeText]);

    const weaponTexture: Record<PremiumWeaponId, string> = {
      'plasma-neon': 'vip-tridente-plasma',
      'misil-sabor': 'vip-misil-sabor',
      'rayo-poseidon': 'vip-rayo-poseidon',
    };
    const outfit = OUTFITS.find((entry) => entry.id === this.membership.selectedOutfit);
    const weapon = PREMIUM_WEAPONS[this.membership.selectedWeapon];
    const benefitCard = this.add
      .container(GAME_WIDTH / 2, 448)
      .setDepth(80)
      .setScrollFactor(0)
      .setAlpha(0)
      .setScale(0.88);
    const glow = this.add
      .rectangle(0, 0, 656, 190, accent, 0.13)
      .setStrokeStyle(6, accent, 0.22);
    const panel = this.add
      .rectangle(0, 0, 638, 172, 0x06142e, 0.97)
      .setStrokeStyle(3, accent, 1);
    const outfitImage = this.add
      .image(-252, 0, outfit?.textureKey ?? 'daddy-pollo')
      .setDisplaySize(142, 142);
    const weaponImage = this.add
      .image(252, 1, weaponTexture[this.membership.selectedWeapon])
      .setDisplaySize(138, 104);
    const heading = this.add
      .text(0, -56, `${icon} BENEFICIOS ${planLabel}`, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '24px',
        color: elite ? '#d9c9ff' : '#ffe36b',
        stroke: '#020718',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const loadout = this.add
      .text(0, -15, `${outfit?.name ?? 'Daddy Clásico'}  •  ${weapon.shortName}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    const benefits = this.add
      .text(
        0,
        37,
        elite
          ? `ARMA VIP 15s  •  AVIÓN 10s  •  PODER ELITE\n${
            this.membership.monthlyBenefit?.available
              ? '🎁 PREMIO MENSUAL DISPONIBLE'
              : '✓ PREMIO MENSUAL YA SOLICITADO'
          }`
          : 'ARMA VIP 15s  •  AVIÓN 10s\n🎁 10% DE DESCUENTO SIEMPRE DISPONIBLE',
        {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '12px',
          color: elite ? '#8cecff' : '#fff0a6',
          align: 'center',
          lineSpacing: 5,
        },
      )
      .setOrigin(0.5);
    benefitCard.add([
      glow,
      panel,
      outfitImage,
      weaponImage,
      heading,
      loadout,
      benefits,
    ]);
    this.tweens.add({
      targets: benefitCard,
      alpha: 1,
      scale: 1,
      duration: 350,
      delay: 300,
      ease: 'Back.out',
      onComplete: () => {
        this.time.delayedCall(2100, () => {
          this.tweens.add({
            targets: benefitCard,
            alpha: 0,
            y: 410,
            duration: 300,
            ease: 'Quad.in',
            onComplete: () => benefitCard.destroy(true),
          });
        });
      },
    });
  }

  private makeVipAbilityButton(
    x: number,
    y: number,
    texture: string,
    label: string,
    shortcut: string,
    color: number,
    onPress: () => void,
  ): VipAbilityControl {
    const visual = this.add.container(x, y).setDepth(48).setScrollFactor(0);
    const glow = this.add
      .circle(0, 0, 55, color, 0.14)
      .setStrokeStyle(3, color, 0.34)
      .setBlendMode(Phaser.BlendModes.ADD);
    const button = this.add
      .circle(0, 0, 47, 0x06142e, 0.96)
      .setStrokeStyle(4, color, 0.94)
      .setInteractive({ useHandCursor: true });
    const progress = this.add.graphics();
    const icon = this.add
      .image(0, -2, texture)
      .setDisplaySize(69, 61);
    const shortcutBg = this.add
      .circle(-38, -38, 14, color, 1)
      .setStrokeStyle(2, 0xffffff, 0.95);
    const shortcutText = this.add
      .text(-38, -38, shortcut, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        stroke: '#020718',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const name = this.add
      .text(0, 57, label, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#020718',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const status = this.add
      .text(0, 76, 'LISTO', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '12px',
        color: '#9ffcff',
        stroke: '#020718',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    visual.add([
      glow,
      button,
      progress,
      icon,
      shortcutBg,
      shortcutText,
      name,
      status,
    ]);
    button.on('pointerdown', () => visual.setScale(0.95));
    button.on('pointerup', (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      visual.setScale(1);
      this.triggerControlHaptic();
      onPress();
    });
    button.on('pointerout', () => visual.setScale(1));
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.45, to: 1 },
      duration: 850,
      yoyo: true,
      repeat: -1,
    });
    return {
      visual,
      icon,
      status,
      button,
      progress,
      glow,
      color,
      stateKey: '',
    };
  }

  private updateMembershipControls(): void {
    if (!hasActiveMembership(this.membership)) return;
    const world = this.currentWorld.id;
    const weaponActive = this.premiumWeaponActiveUntil > this.time.now;
    const weaponUsed = this.premiumWeaponUsedWorlds.has(world);
    if (this.premiumWeaponControl) {
      const seconds = Math.max(0, Math.ceil((this.premiumWeaponActiveUntil - this.time.now) / 1000));
      this.setVipAbilityState(
        this.premiumWeaponControl,
        weaponActive ? seconds / 15 : weaponUsed ? 0 : 1,
        weaponActive ? `${seconds}s` : weaponUsed ? 'USADA' : 'LISTA',
        weaponUsed && !weaponActive,
        weaponActive,
      );
    }
    const planeActive = this.premiumPlaneExpiresAt > this.time.now;
    const planeUsed = this.premiumPlaneUsedWorlds.has(world);
    if (this.premiumPlaneControl) {
      const seconds = Math.max(0, Math.ceil((this.premiumPlaneExpiresAt - this.time.now) / 1000));
      this.setVipAbilityState(
        this.premiumPlaneControl,
        planeActive ? seconds / 10 : planeUsed ? 0 : 1,
        planeActive ? `${seconds}s` : planeUsed ? 'USADO' : 'LISTO',
        planeUsed && !planeActive,
        planeActive,
      );
    }
    if (this.elitePowerControl) {
      const used = this.elitePowerUsedWorlds.has(world);
      this.elitePowerControl.icon.setTexture(this.getElitePowerTexture());
      this.setVipAbilityState(
        this.elitePowerControl,
        used ? 0 : this.elitePowerCharge / 100,
        used ? 'USADO' : this.elitePowerCharge >= 100
          ? 'LISTO'
          : `${Math.round(this.elitePowerCharge)}%`,
        used,
        !used && this.elitePowerCharge >= 100,
      );
    }
  }

  private setVipAbilityState(
    control: VipAbilityControl,
    ratio: number,
    status: string,
    disabled: boolean,
    active: boolean,
  ): void {
    const progress = Phaser.Math.Clamp(ratio, 0, 1);
    const stateKey = `${status}|${Math.round(progress * 100)}|${disabled}|${active}`;
    if (control.stateKey === stateKey) {
      return;
    }
    control.stateKey = stateKey;
    control.progress.clear();
    control.progress.lineStyle(7, 0xffffff, 0.13);
    control.progress.strokeCircle(0, 0, 51);
    if (progress > 0) {
      control.progress.lineStyle(7, control.color, disabled ? 0.2 : 1);
      control.progress.beginPath();
      control.progress.arc(
        0,
        0,
        51,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      control.progress.strokePath();
    }
    control.status
      .setText(status)
      .setColor(disabled ? '#70809c' : active ? '#fff36b' : '#9ffcff');
    control.icon.setAlpha(disabled ? 0.28 : 1);
    control.button
      .setAlpha(disabled ? 0.62 : 1)
      .setStrokeStyle(4, disabled ? 0x52637e : control.color, disabled ? 0.48 : 0.96);
    control.glow.setVisible(!disabled).setAlpha(active ? 0.9 : 0.42);
  }

  private showAbilityStatus(
    control: VipAbilityControl | undefined,
    message: string,
    color: number,
  ): void {
    if (!control) return;
    const toast = this.add.container(control.visual.x - 66, control.visual.y).setDepth(83);
    const panel = this.add
      .rectangle(0, 0, 152, 40, 0x06142e, 0.94)
      .setOrigin(1, 0.5)
      .setStrokeStyle(2, color, 0.9);
    const text = this.add
      .text(-12, 0, message, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#020718',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);
    toast.add([panel, text]);
    this.tweens.add({
      targets: toast,
      x: toast.x - 28,
      alpha: { from: 1, to: 0 },
      duration: 900,
      hold: 300,
      ease: 'Cubic.out',
      onComplete: () => toast.destroy(true),
    });
  }

  private pulseAbilityControl(
    control: VipAbilityControl | undefined,
    color: number,
    message: string,
  ): void {
    if (!control) return;
    this.tweens.add({
      targets: control.visual,
      scale: { from: 0.82, to: 1.12 },
      duration: 180,
      yoyo: true,
      ease: 'Back.out',
    });
    for (let index = 0; index < 3; index += 1) {
      const ring = this.add
        .circle(control.visual.x, control.visual.y, 48, color, 0)
        .setStrokeStyle(5 - index, color, 0.85)
        .setDepth(47);
      this.tweens.add({
        targets: ring,
        scale: 1.8 + index * 0.34,
        alpha: 0,
        duration: 520 + index * 120,
        delay: index * 70,
        ease: 'Cubic.out',
        onComplete: () => ring.destroy(),
      });
    }
    const burst = this.add.particles(control.visual.x, control.visual.y, '__WHITE', {
      speed: { min: 75, max: 190 },
      lifespan: { min: 280, max: 520 },
      scale: { start: 0.34, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, 0xffffff, COLORS.yellow],
      quantity: 18,
      blendMode: 'ADD',
    }).setDepth(49);
    this.time.delayedCall(560, () => burst.destroy());
    this.showAbilityStatus(control, message, color);
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

    // VIP cadence: the first combat bike and every later opportunity arrive
    // only once per 25-second window, including during boss encounters.
    this.time.addEvent({
      delay: 25000,
      loop: true,
      callback: () => this.spawnCombatBikePickup(),
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

  update(time: number, delta: number): void {
    if (this.paused || this.gameOver) {
      return;
    }
    this.updateBackgroundMotion(time);
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
      const wantsCover = Boolean(
        !this.combatBike.isActive &&
        (this.coverPressed ||
          this.coverTouchPointers.size > 0 ||
          this.keyS?.isDown ||
          this.keyShift?.isDown),
      );
      this.updateCover(wantsCover, delta);
      const keyboardJump =
        (this.cursors ? Phaser.Input.Keyboard.JustDown(this.cursors.up) : false) ||
        (this.keyW ? Phaser.Input.Keyboard.JustDown(this.keyW) : false);
      if (keyboardJump) {
        this.tryJump();
      }
      if (this.keyOne && Phaser.Input.Keyboard.JustDown(this.keyOne)) {
        this.activatePremiumWeapon();
      }
      if (this.keyTwo && Phaser.Input.Keyboard.JustDown(this.keyTwo)) {
        this.activateElitePower();
      }
      if (this.keyThree && Phaser.Input.Keyboard.JustDown(this.keyThree)) {
        this.activatePremiumPlane();
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
    this.updateMembershipAbilities();
    if (this.combatBike.update(this.player, delta)) {
      this.deactivateCombatBike(false);
    }
    if (
      this.combatBike.isActive &&
      this.time.now >= this.nextCombatBikeShotAt
    ) {
      this.nextCombatBikeShotAt = this.time.now + 360;
      this.fireCombatBikeVolley();
    }

    const wantsToFire = this.firePressed || this.fireTouchPointers.size > 0 || this.keySpace?.isDown || this.keyF?.isDown;
    if (wantsToFire && !this.player.isCovering()) {
      this.tryFireWeapon();
    }

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

    if (this.generalActive && this.general.active) {
      try {
        const generalUpdate = this.general.updateBoss(
          this.time.now,
          this.difficultySpeedMultiplier,
          delta,
          this.player.x,
        );
        if (generalUpdate.shouldAttack) {
          this.spawnGeneralAttack(generalUpdate.phase);
        }
      } catch (error) {
        console.error('Se recuperó el ciclo de combate del general.', error);
        this.cameras.main.resetFX();
      }
    }

    if (this.bossActive) {
      try {
        const encounterBosses = this.getEncounterBosses();
        encounterBosses.forEach((encounterBoss, index) => {
          if (!encounterBoss.active) {
            return;
          }
          const bossUpdate = encounterBoss.updateBoss(
            this.time.now,
            this.difficultySpeedMultiplier,
            delta,
            this.player.x,
          );
          if (bossUpdate.shouldAttack) {
            this.spawnBossAttack(bossUpdate.phase, encounterBoss, index);
          }
        });
        if (
          encounterBosses.some((encounterBoss) => encounterBoss.active) &&
          this.time.now >= this.nextBossReinforcementAt
        ) {
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
        this.generalActive &&
        this.general.active &&
        this.projectileTouchesBoss(projectile, this.general)
      ) {
        this.onProjectileHitGeneral(projectile);
        return true;
      }
      const hitBoss = this.bossActive
        ? this.getEncounterBosses().find(
          (encounterBoss) =>
            encounterBoss.active && this.projectileTouchesBoss(projectile, encounterBoss),
        )
        : undefined;
      if (hitBoss) {
        this.onProjectileHitBoss(projectile, hitBoss);
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
        const projectileKind = String(projectile.getData('projectileKind') ?? 'standard');
        if (
          projectileKind === 'alien-fighter' &&
          this.time.now >= Number(projectile.getData('nextShotAt') ?? Number.POSITIVE_INFINITY)
        ) {
          projectile.setData('nextShotAt', Number.POSITIVE_INFINITY);
          this.spawnAlienFighterShots(projectile);
        }
        if (
          (projectileKind === 'atomic-bomb' && projectile.y > GAME_HEIGHT - 190) ||
          (projectileKind === 'alien-fighter' && projectile.y > GAME_HEIGHT - 170)
        ) {
          this.detonateBossProjectile(
            projectile,
            projectileKind === 'atomic-bomb' ? 185 : 125,
            projectileKind === 'atomic-bomb' ? 0xffb21c : 0xc865ff,
          );
          return true;
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
    if (this.generalActive) {
      this.timeText.setText('GENERAL').setColor(this.currentGeneral?.colorHex ?? COLORS_HEX.yellow);
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

    if (this.shouldStartGeneralBattle(worldDuration)) {
      this.startGeneralBattle();
      return;
    }

    if (this.timeLeft <= 0) {
      this.startBossBattle();
    }
  }

  private shouldStartGeneralBattle(worldDuration: number): boolean {
    const definition = getGeneralForWorld(this.currentWorld.id);
    if (
      !definition ||
      this.generalActive ||
      this.defeatedGeneralWorlds.has(this.currentWorld.id)
    ) {
      return false;
    }
    const elapsedRatio = 1 - Math.max(0, this.timeLeft) / Math.max(1, worldDuration);
    return elapsedRatio >= GENERAL_TRIGGER_PROGRESS;
  }

  private createGeneralBossDefinition(definition: GeneralDefinition): WorldDefinition {
    return {
      id: this.currentWorld.id,
      name: this.currentWorld.name,
      subtitle: definition.title,
      backgroundKey: this.currentWorld.backgroundKey,
      bossName: definition.name,
      bossTexture: definition.textureKey,
      bossHealth: definition.health,
      bossPoints: definition.points,
      bossPattern: 'standard',
      color: definition.color,
      colorHex: definition.colorHex,
      projectileTexture: definition.projectileTexture,
      attackIntervalMs: definition.attackIntervalMs,
      projectileSpeed: definition.projectileSpeed,
    };
  }

  private startGeneralBattle(): void {
    const definition = getGeneralForWorld(this.currentWorld.id);
    if (
      !definition ||
      this.generalActive ||
      this.bossActive ||
      this.worldTransitioning ||
      this.gameOver ||
      this.defeatedGeneralWorlds.has(this.currentWorld.id)
    ) {
      return;
    }

    this.worldTransitioning = true;
    this.stopWorldTimers();
    this.currentGeneral = definition;
    if (this.physics.world.isPaused) {
      this.physics.resume();
    }

    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (enemy.active) {
        enemy.recycle();
      }
      return true;
    });
    this.enemyProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) {
        this.recycleEnemyProjectile(projectile);
      }
      return true;
    });
    this.bossProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) {
        this.recycleEnemyProjectile(projectile);
      }
      return true;
    });

    this.timeText.setText('GENERAL').setColor(definition.colorHex);
    this.comboText.setVisible(false);
    this.powerText.setVisible(false);
    this.bossNameText
      .setText(`⚔ ${definition.title.toUpperCase()} · ${definition.name.toUpperCase()} ⚔  •  VIDA 100%`)
      .setColor(definition.colorHex)
      .setVisible(true);
    this.bossHealthBg.setVisible(true);
    this.bossHealthFill
      .setFillStyle(definition.color, 1)
      .setScale(1, 1)
      .setVisible(true);

    if (this.premiumWeaponActiveUntil > this.time.now && hasActiveMembership(this.membership)) {
      const weapon = PREMIUM_WEAPONS[this.membership.selectedWeapon];
      const seconds = Math.max(0, Math.ceil((this.premiumWeaponActiveUntil - this.time.now) / 1000));
      this.weaponText
        .setText(`★ ${weapon.shortName} VIP  •  ${seconds}s`)
        .setColor(weapon.colorHex);
    } else if (this.activeWeapon) {
      this.weaponAmmo = Math.max(this.weaponAmmo, WEAPONS[this.activeWeapon].ammo);
    } else {
      this.equipStartingWeapon();
    }
    this.updateHud();

    try {
      this.general.spawn(
        this.createGeneralBossDefinition(definition),
        this.time.now,
        this.difficultyLevel,
        {
          texture: definition.textureKey,
          startX: GAME_WIDTH / 2,
          baseY: definition.baseY,
          direction: -1,
          displayWidth: definition.displayWidth,
          displayHeight: definition.displayHeight,
          patrolMinX: 190,
          patrolMaxX: GAME_WIDTH - 190,
        },
      );
    } catch (error) {
      console.error('No se pudo iniciar el general; se reintentará.', error);
      this.currentGeneral = undefined;
      this.worldTransitioning = false;
      this.timeLeft += 3;
      this.timeText.setText(String(this.timeLeft)).setColor(COLORS_HEX.yellow);
      this.bossNameText.setVisible(false);
      this.bossHealthBg.setVisible(false);
      this.bossHealthFill.setVisible(false);
      this.comboText.setVisible(true);
      this.powerText.setVisible(true);
      this.startWorldTimers();
      return;
    }

    this.generalActive = true;
    this.worldTransitioning = false;
    this.cameras.main.resetFX();
    this.cameras.main.shake(320, 0.011);
    audioManager.play('blast');

    const warning = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        `¡GENERAL EN COMBATE!\n${definition.name}`,
        {
          fontFamily: 'Arial Black',
          fontSize: '54px',
          color: definition.colorHex,
          stroke: '#020718',
          strokeThickness: 10,
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({
      targets: warning,
      scale: { from: 0.68, to: 1.05 },
      alpha: { from: 1, to: 0 },
      duration: 950,
      hold: 300,
      ease: 'Back.out',
      onComplete: () => warning.destroy(),
    });
  }

  private startBossBattle(): void {
    if (this.bossActive || this.generalActive || this.worldTransitioning || this.gameOver) {
      return;
    }
    this.worldTransitioning = true;
    this.stopWorldTimers();
    if (this.physics.world.isPaused) {
      this.physics.resume();
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
      const pattern = this.currentWorld.bossPattern ?? 'standard';
      if (pattern === 'dual-elemental') {
        this.boss.spawn(this.currentWorld, this.time.now, this.difficultyLevel, {
          texture: this.currentWorld.bossTexture,
          startX: 265,
          baseY: 330,
          direction: 1,
          displayWidth: 270,
          displayHeight: 350,
          patrolMinX: 150,
          patrolMaxX: 455,
        });
        this.secondaryBoss.spawn(this.currentWorld, this.time.now, this.difficultyLevel, {
          texture: this.currentWorld.secondaryBossTexture,
          startX: GAME_WIDTH - 265,
          baseY: 330,
          direction: -1,
          displayWidth: 270,
          displayHeight: 350,
          patrolMinX: GAME_WIDTH - 455,
          patrolMaxX: GAME_WIDTH - 150,
        });
      } else {
        if (this.secondaryBoss.active) {
          this.secondaryBoss.recycle();
        }
        this.boss.spawn(this.currentWorld, this.time.now, this.difficultyLevel, {
          displayWidth: pattern === 'atomic-aircraft' ? 450 : pattern === 'alien-carrier' ? 410 : 330,
          displayHeight: pattern === 'atomic-aircraft' ? 285 : pattern === 'alien-carrier' ? 345 : 430,
          baseY: pattern === 'atomic-aircraft' ? 270 : 325,
        });
      }
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

  private getEncounterBosses(): Boss[] {
    return this.currentWorld.bossPattern === 'dual-elemental'
      ? [this.boss, this.secondaryBoss]
      : [this.boss];
  }

  private spawnGeneralAttack(phase: number): void {
    const definition = this.currentGeneral;
    if (!definition || !this.general.active || !this.generalActive) {
      return;
    }

    this.general.playAttackMotion(this.time.now);
    const playerVelocityX = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    const generalMuzzle = this.general.getMuzzlePosition(0);
    const baseAngle = Phaser.Math.Angle.Between(
      generalMuzzle.x,
      generalMuzzle.y,
      this.player.x + playerVelocityX * 0.16,
      this.player.y - 42,
    );

    const launchVolley = (
      count: number,
      spread: number,
      textureForIndex: (index: number) => string,
      kind: string,
      displayWidth: number,
      displayHeight: number,
      speedMultiplier: number,
      curveAmount: number,
      angularVelocity: number,
    ): void => {
      for (let index = 0; index < count; index += 1) {
        const offset = count === 1
          ? 0
          : Phaser.Math.Linear(-spread / 2, spread / 2, index / (count - 1));
        this.spawnBossProjectile(baseAngle + offset, phase, index, this.general, 0, {
          texture: textureForIndex(index),
          kind,
          displayWidth,
          displayHeight,
          speedMultiplier,
          curve: index % 2 === 0 ? curveAmount : -curveAmount,
          useMaliciousIcon: false,
          angularVelocity: index % 2 === 0 ? angularVelocity : -angularVelocity,
          baseSpeed: definition.projectileSpeed,
          attackerName: definition.name,
        });
      }
    };

    switch (definition.pattern) {
      case 'stormBarrage':
        launchVolley(
          2 + phase,
          0.45 + phase * 0.08,
          () => definition.projectileTexture,
          'general-chain-shot',
          52,
          46,
          1,
          22 + phase * 5,
          190,
        );
        break;
      case 'toxicMortar':
        launchVolley(
          2 + phase,
          0.58 + phase * 0.07,
          () => definition.projectileTexture,
          'general-toxic-mortar',
          58,
          58,
          0.86,
          38 + phase * 6,
          115,
        );
        break;
      case 'elementalCrossfire':
        launchVolley(
          2 + phase,
          0.62 + phase * 0.09,
          (index) =>
            index % 2 === 0
              ? definition.projectileTexture
              : definition.secondaryProjectileTexture ?? 'ataque-hielo',
          'general-elemental-shot',
          48,
          48,
          1.03,
          30 + phase * 7,
          150,
        );
        break;
      case 'cosmicAssault':
        launchVolley(
          3 + phase,
          0.82 + phase * 0.1,
          () => definition.projectileTexture,
          'general-cosmic-orb',
          54,
          54,
          1.06,
          52 + phase * 8,
          235,
        );
        break;
    }

    this.finishBossAttackMotion(this.general, definition.color);
  }

  private spawnBossAttack(phase: number, attacker: Boss, bossIndex: number): void {
    const pattern = this.currentWorld.bossPattern ?? 'standard';
    if (pattern === 'atomic-aircraft') {
      this.spawnAircraftAttack(phase, attacker);
      return;
    }
    if (pattern === 'alien-carrier') {
      this.spawnAlienCarrierAttack(phase, attacker);
      return;
    }

    const world = this.currentWorld;
    attacker.playAttackMotion(this.time.now);
    const difficultyProjectiles = Math.floor(this.difficultyLevel / 4);
    const count = pattern === 'dual-elemental'
      ? Math.min(6, 2 + phase + difficultyProjectiles)
      : Math.min(9, 1 + world.id + difficultyProjectiles + (phase >= 2 ? 1 : 0));
    const muzzlePosition = attacker.getMuzzlePosition(0);
    const baseAngle = Phaser.Math.Angle.Between(
      muzzlePosition.x,
      muzzlePosition.y,
      this.player.x,
      this.player.y - 45,
    );
    const spread = pattern === 'dual-elemental' ? 0.62 : world.id === 1 ? 0.55 : 0.82 + world.id * 0.08;
    const elementalTexture = bossIndex === 1
      ? world.secondaryProjectileTexture ?? 'ataque-hielo'
      : world.projectileTexture;
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1
        ? 0
        : Phaser.Math.Linear(-spread / 2, spread / 2, index / (count - 1));
      try {
        this.spawnBossProjectile(baseAngle + offset, phase, index, attacker, bossIndex, {
          texture: elementalTexture,
          useMaliciousIcon: pattern !== 'dual-elemental',
          curve: pattern === 'dual-elemental'
            ? (bossIndex === 0 ? 24 : -24)
            : world.id >= 4
              ? (index % 2 === 0 ? 34 : -34)
              : 0,
        });
      } catch (error) {
        console.error('Se omitió un proyectil inválido del gran jefe.', error);
      }
    }
    this.finishBossAttackMotion(attacker, bossIndex === 1 ? 0x53e7ff : world.color);
  }

  private spawnAircraftAttack(phase: number, attacker: Boss): void {
    attacker.playAttackMotion(this.time.now);
    const launchBombs = this.bossAttackSequence % 2 === 0;
    this.bossAttackSequence += 1;
    const count = launchBombs ? 3 + (phase >= 3 ? 1 : 0) : 4 + phase;
    const muzzlePosition = attacker.getMuzzlePosition(0);
    const baseAngle = Phaser.Math.Angle.Between(
      muzzlePosition.x,
      muzzlePosition.y,
      this.player.x,
      this.player.y - 25,
    );
    const spread = launchBombs ? 0.46 : 0.82;
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1
        ? 0
        : Phaser.Math.Linear(-spread / 2, spread / 2, index / (count - 1));
      this.spawnBossProjectile(baseAngle + offset, phase, index, attacker, 0, {
        texture: launchBombs ? 'ataque-atomico' : 'ataque-rayo',
        kind: launchBombs ? 'atomic-bomb' : 'energy-ray',
        displayWidth: launchBombs ? 60 : 34,
        displayHeight: launchBombs ? 68 : 92,
        speedMultiplier: launchBombs ? 0.67 : 1.34,
        useMaliciousIcon: false,
        angularVelocity: launchBombs ? (index % 2 === 0 ? 125 : -125) : 0,
      });
    }
    this.finishBossAttackMotion(attacker, launchBombs ? 0xffb21c : 0x8ffcff);
    this.showFloatingText(
      attacker.x,
      attacker.y + 100,
      launchBombs ? '☢ BOMBAS ATÓMICAS' : '⚡ RAYOS DE ENERGÍA',
      launchBombs ? '#ffd45c' : '#9ffcff',
    );
    audioManager.play('blast');
  }

  private spawnAlienCarrierAttack(phase: number, attacker: Boss): void {
    attacker.playAttackMotion(this.time.now);
    const muzzlePosition = attacker.getMuzzlePosition(0);
    const baseAngle = Phaser.Math.Angle.Between(
      muzzlePosition.x,
      muzzlePosition.y,
      this.player.x,
      this.player.y - 35,
    );
    const boltCount = 3 + phase;
    for (let index = 0; index < boltCount; index += 1) {
      const offset = Phaser.Math.Linear(-0.48, 0.48, index / Math.max(1, boltCount - 1));
      this.spawnBossProjectile(baseAngle + offset, phase, index, attacker, 0, {
        texture: 'ataque-alien',
        kind: 'alien-shot',
        displayWidth: 32,
        displayHeight: 60,
        speedMultiplier: 1.1,
        useMaliciousIcon: false,
        angularVelocity: 0,
      });
    }
    const fighterCount = phase >= 3 ? 3 : 2;
    for (let index = 0; index < fighterCount; index += 1) {
      const fighter = this.spawnBossProjectile(
        baseAngle + Phaser.Math.Linear(-0.38, 0.38, index / Math.max(1, fighterCount - 1)),
        phase,
        index,
        attacker,
        0,
        {
          texture: 'mini-nave-alien',
          kind: 'alien-fighter',
          displayWidth: 68,
          displayHeight: 68,
          speedMultiplier: 0.56,
          useMaliciousIcon: false,
          angularVelocity: 0,
        },
      );
      fighter?.setData('nextShotAt', this.time.now + 520 + index * 130);
    }
    this.finishBossAttackMotion(attacker, 0xc865ff);
    this.showFloatingText(attacker.x, attacker.y + 105, '🛸 CAZAS DE ATAQUE', '#e4a4ff');
    audioManager.play('enemy');
  }

  private spawnBossProjectile(
    angle: number,
    phase: number,
    patternIndex: number,
    attacker: Boss,
    bossIndex: number,
    options: BossProjectileOptions = {},
  ): Phaser.Physics.Arcade.Image | null {
    const world = this.currentWorld;
    const shouldUseMaliciousIcon = options.useMaliciousIcon ?? true;
    const useMaliciousIcon =
      shouldUseMaliciousIcon && (this.bossProjectileIndex + patternIndex) % 3 !== 2;
    const texture = useMaliciousIcon
      ? BAD_ITEMS[(this.bossProjectileIndex + patternIndex) % BAD_ITEMS.length].key
      : options.texture ?? world.projectileTexture;
    this.bossProjectileIndex += 1;
    const muzzlePosition = attacker.getMuzzlePosition(patternIndex);
    const originX = options.originX ?? muzzlePosition.x;
    const originY = options.originY ?? muzzlePosition.y;
    const projectile = this.bossProjectiles.get(originX, originY, texture) as
      | Phaser.Physics.Arcade.Image
      | null;
    if (!projectile) {
      return null;
    }

    const size = options.size ?? (useMaliciousIcon ? 48 + world.id * 2 : 42 + world.id * 2);
    const displayWidth = options.displayWidth ?? size;
    const displayHeight = options.displayHeight ?? size;
    const bossName = options.attackerName ?? (
      bossIndex === 1
        ? world.secondaryBossName ?? world.bossName
        : world.bossName
    );
    projectile
      .setTexture(texture)
      .setActive(true)
      .setVisible(true)
      .setPosition(originX, originY)
      .setDisplaySize(displayWidth, displayHeight)
      .setDepth(18)
      .setAlpha(1)
      .setAngle(0)
      .setTint(useMaliciousIcon ? 0xff647c : 0xffffff)
      .setData('bossProjectile', true)
      .setData('bossName', bossName)
      .setData('enemyType', null)
      .setData('projectileKind', options.kind ?? 'standard')
      .setData('nextShotAt', Number.POSITIVE_INFINITY)
      .setData('curve', options.curve ?? 0);
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(projectile.x, projectile.y);
    body.setAllowGravity(false);
    body.setCircle(projectile.width * 0.37);
    const speed =
      (options.baseSpeed ?? world.projectileSpeed) *
      this.difficultySpeedMultiplier *
      (1 + (phase - 1) * 0.1) *
      (options.speedMultiplier ?? 1);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    projectile.setAngularVelocity(
      options.angularVelocity ??
      (patternIndex % 2 === 0 ? 1 : -1) * (150 + world.id * 35),
    );
    return projectile;
  }

  private finishBossAttackMotion(attacker: Boss, color: number): void {
    try {
      const muzzlePosition = attacker.getMuzzlePosition(this.bossProjectileIndex);
      this.emitMuzzleFlash(muzzlePosition.x, muzzlePosition.y, color);
      this.tweens.add({
        targets: attacker,
        scaleX: attacker.scaleX * 1.08,
        scaleY: attacker.scaleY * 0.94,
        duration: 90,
        yoyo: true,
      });
    } catch (error) {
      console.error('Se omitió un efecto visual del gran jefe.', error);
    }
    audioManager.play(this.currentWorld.id === 2 ? 'blast' : 'enemy');
  }

  private spawnAlienFighterShots(fighter: Phaser.Physics.Arcade.Image): void {
    for (const [index, offset] of [-0.16, 0.16].entries()) {
      this.spawnBossProjectile(
        Math.PI / 2 + offset,
        1,
        index,
        this.boss,
        0,
        {
          texture: 'ataque-alien',
          kind: 'alien-shot',
          displayWidth: 26,
          displayHeight: 52,
          speedMultiplier: 1.35,
          useMaliciousIcon: false,
          originX: fighter.x,
          originY: fighter.y + 30,
          angularVelocity: 0,
        },
      );
    }
    this.emitMuzzleFlash(fighter.x, fighter.y + 28, 0xc865ff);
  }

  private detonateBossProjectile(
    projectile: Phaser.Physics.Arcade.Image,
    radius: number,
    color: number,
  ): void {
    const x = projectile.x;
    const y = projectile.y;
    const hitsPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y - 35) <= radius;
    if (hitsPlayer) {
      this.onEnemyProjectileHit(projectile);
    } else {
      this.recycleEnemyProjectile(projectile);
    }
    this.emitShockwave(x, y, radius, color);
    this.emitSparkle(x, y, color);
    this.cameras.main.shake(radius > 150 ? 280 : 170, radius > 150 ? 0.014 : 0.009);
    audioManager.play('blast');
  }

  private onProjectileHitGeneral(projectile: Phaser.Physics.Arcade.Image): void {
    if (!projectile.active || !this.general.active || !this.generalActive) {
      return;
    }
    const weaponType = projectile.getData('weapon') as WeaponType;
    const weapon = WEAPONS[weaponType];
    if (!weapon) {
      console.error('Se descartó un disparo sin tipo de arma válido contra el general.');
      this.recycleProjectile(projectile);
      return;
    }

    const damage = weapon.damage;
    const hitX = projectile.x;
    const hitY = projectile.y;
    this.recycleProjectile(projectile);
    const defeated = this.general.takeHit(damage);
    this.chargeElitePower(Math.max(3, damage * 2));
    this.updateGeneralHealthHud();

    try {
      this.emitSparkle(hitX, hitY, weapon.color);
      audioManager.play('shot');
    } catch (error) {
      console.error('Se omitió un efecto visual de daño al general.', error);
    }
    if (defeated) {
      this.chargeElitePower(35);
      this.defeatGeneral();
    }
  }

  private updateGeneralHealthHud(): void {
    const definition = this.currentGeneral;
    if (!definition) {
      return;
    }
    const remainingPercent = Math.max(0, Math.ceil(this.general.healthRatio * 100));
    this.bossHealthFill.setScale(this.general.healthRatio, 1);
    this.bossNameText.setText(
      `⚔ ${definition.title.toUpperCase()} · ${definition.name.toUpperCase()} ⚔  •  VIDA ${remainingPercent}%`,
    );
  }

  private defeatGeneral(): void {
    const definition = this.currentGeneral;
    if (!definition || !this.generalActive) {
      return;
    }

    this.generalActive = false;
    this.worldTransitioning = true;
    this.defeatedGeneralWorlds.add(this.currentWorld.id);
    const effectX = this.general.x;
    const effectY = this.general.y;
    const body = this.general.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
      body.setVelocity(0, 0);
    }
    this.general.hideAnimatedParts();
    this.general.setActive(false);

    this.bossProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) {
        this.recycleEnemyProjectile(projectile);
      }
      return true;
    });

    const awardedPoints = this.adjustPointsForDifficulty(definition.points);
    this.score += awardedPoints;
    this.bossHealthFill.setScale(0, 1);
    this.bossNameText
      .setText(`¡GENERAL DERROTADO!  •  +${awardedPoints}`)
      .setColor(COLORS_HEX.yellow);
    this.updateHud();
    this.showFloatingText(
      effectX,
      effectY,
      `+${awardedPoints} • ${definition.name.toUpperCase()}`,
      definition.colorHex,
    );
    this.emitShockwave(effectX, effectY, 190, definition.color);
    this.cameras.main.shake(480, 0.018);
    audioManager.play('combo');

    this.tweens.add({
      targets: this.general,
      y: effectY - 100,
      alpha: 0,
      angle: 20,
      scaleX: this.general.scaleX * 1.25,
      scaleY: this.general.scaleY * 1.25,
      duration: 820,
      ease: 'Cubic.in',
      onComplete: () => this.general.recycle(),
    });

    this.time.delayedCall(1350, () => {
      if (this.gameOver) {
        return;
      }
      this.currentGeneral = undefined;
      this.bossNameText.setVisible(false);
      this.bossHealthBg.setVisible(false);
      this.bossHealthFill.setVisible(false);
      this.comboText.setVisible(true);
      this.powerText.setVisible(true);
      this.timeText.setText(String(this.timeLeft)).setColor(COLORS_HEX.yellow);
      this.worldTransitioning = false;
      this.startWorldTimers();
      this.spawnWeaponPickup();
      this.updateHud();
    });
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
    const damage = weapon.damage;
    const hitX = projectile.x;
    const hitY = projectile.y;
    this.recycleProjectile(projectile);
    const defeated = boss.takeHit(damage);
    this.chargeElitePower(Math.max(3, damage * 2));
    this.updateBossHealthHud();

    try {
      this.emitSparkle(hitX, hitY, weapon.color);
      audioManager.play('shot');
    } catch (error) {
      console.error('Se omitió un efecto visual de daño al jefe.', error);
    }
    if (defeated) {
      const encounterFinished = this.getEncounterBosses().every(
        (encounterBoss) => encounterBoss.healthRatio <= 0,
      );
      if (encounterFinished) {
        this.defeatBoss();
      } else {
        this.retireDefeatedBoss(boss);
      }
    }
  }

  private updateBossHealthHud(): void {
    const encounterBosses = this.getEncounterBosses();
    const combinedRatio =
      encounterBosses.reduce((sum, encounterBoss) => sum + encounterBoss.healthRatio, 0) /
      encounterBosses.length;
    const remainingPercent = Math.max(0, Math.ceil(combinedRatio * 100));
    this.bossHealthFill.setScale(combinedRatio, 1);
    this.bossNameText.setText(
      `⚠ ${this.currentWorld.bossName.toUpperCase()} ⚠  •  VIDA ${remainingPercent}%`,
    );
  }

  private retireDefeatedBoss(defeatedBoss: Boss): void {
    const body = defeatedBoss.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
      body.setVelocity(0, 0);
    }
    defeatedBoss.hideAnimatedParts();
    defeatedBoss.setActive(false);
    this.showFloatingText(defeatedBoss.x, defeatedBoss.y, '¡UNO MENOS!', COLORS_HEX.yellow);
    this.tweens.add({
      targets: defeatedBoss,
      alpha: 0,
      angle: defeatedBoss === this.boss ? -20 : 20,
      y: defeatedBoss.y - 90,
      duration: 620,
      ease: 'Cubic.in',
      onComplete: () => defeatedBoss.recycle(),
    });
  }

  private projectileTouchesBoss(
    projectile: Phaser.Physics.Arcade.Image,
    targetBoss: Boss,
  ): boolean {
    const horizontalRadius = Math.max(86, targetBoss.displayWidth * 0.39);
    const verticalRadius = Math.max(95, targetBoss.displayHeight * 0.43);
    return (
      Math.abs(projectile.x - targetBoss.x) <= horizontalRadius &&
      Math.abs(projectile.y - targetBoss.y) <= verticalRadius
    );
  }

  private defeatBoss(): void {
    if (!this.bossActive) {
      return;
    }
    const defeatedWorld = this.currentWorld;
    this.bossActive = false;
    this.worldTransitioning = true;
    if (this.combatBike.isActive) {
      this.deactivateCombatBike(false);
    }
    this.bossHealthFill.setScale(0, 1);
    this.bossNameText.setText('¡JEFE DERROTADO!  •  VIDA 0%').setColor(COLORS_HEX.yellow);
    const encounterBosses = this.getEncounterBosses();
    const effectX =
      encounterBosses.reduce((sum, encounterBoss) => sum + encounterBoss.x, 0) /
      encounterBosses.length;
    const effectY =
      encounterBosses.reduce((sum, encounterBoss) => sum + encounterBoss.y, 0) /
      encounterBosses.length;
    encounterBosses.forEach((encounterBoss) => {
      const bossBody = encounterBoss.body as Phaser.Physics.Arcade.Body | null;
      if (bossBody) {
        bossBody.enable = false;
        bossBody.setVelocity(0, 0);
      }
      encounterBoss.hideAnimatedParts();
      encounterBoss.setActive(false);
    });
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
      this.showFloatingText(effectX, effectY, `+${awardedPoints} • JEFE`, COLORS_HEX.yellow);
      this.emitShockwave(effectX, effectY, 240, defeatedWorld.color);
      this.cameras.main.shake(650, 0.022);
      audioManager.play('combo');
      encounterBosses.forEach((encounterBoss, index) => {
        if (!encounterBoss.visible) {
          return;
        }
        this.tweens.add({
          targets: encounterBoss,
          alpha: 0,
          angle: index === 0 ? 24 : -24,
          scaleX: encounterBoss.scaleX * 1.45,
          scaleY: encounterBoss.scaleY * 1.45,
          duration: 780,
          ease: 'Cubic.in',
          onComplete: () => encounterBoss.recycle(),
        });
      });
    } catch (error) {
      console.error('Se omitió un efecto de derrota; la campaña continuará.', error);
      encounterBosses.forEach((encounterBoss) => encounterBoss.recycle());
    }
  }

  private advanceToNextWorld(): void {
    const previousWorld = this.currentWorld;
    this.currentWorldIndex += 1;
    const nextWorld = this.currentWorld;
    storage.unlockWorld(nextWorld.id);
    this.premiumWeaponActiveUntil = 0;
    this.premiumPlaneExpiresAt = 0;
    this.premiumPlane?.destroy(true);
    this.premiumPlane = undefined;
    this.elitePowerCharge = import.meta.env.DEV ? 100 : 25;
    this.worldPaceStage = 0;
    this.nextEnemyIndex = 0;
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
    this.updateMembershipControls();
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
      this.worldTransitioning = false;
      this.startWorldTimers();
      this.spawnWeaponPickup();
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
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        `¡CAMPAÑA COMPLETA!\nSUPERASTE LOS ${WORLDS.length} MUNDOS`,
        {
        fontFamily: 'Arial Black',
        fontSize: '55px',
        color: COLORS_HEX.yellow,
        stroke: '#020718',
        strokeThickness: 10,
        align: 'center',
        },
      )
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

  private spawnCombatBikePickup(): void {
    const pickupAlreadyFalling = this.items.getChildren().some((child) => {
      const item = child as FallingItem;
      return item.active && item.definition?.power === 'combatBike';
    });
    if (
      this.paused ||
      this.gameOver ||
      this.worldTransitioning ||
      this.combatBike.isActive ||
      pickupAlreadyFalling
    ) {
      return;
    }
    const definition = POWER_ITEMS.find((item) => item.power === 'combatBike');
    if (!definition) {
      return;
    }
    this.spawnDefinition(definition, 0.68);

    const notice = this.add
      .text(GAME_WIDTH / 2, 300, '🏍 PREMIO VIP • MOTO DADDY EN CAMINO', {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: COLORS_HEX.yellow,
        stroke: '#06143a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(48);
    this.tweens.add({
      targets: notice,
      y: 275,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.8, to: 1.08 },
      duration: 1300,
      ease: 'Cubic.out',
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
      this.generalActive ||
      (this.bossActive && !bossSupport) ||
      this.worldTransitioning ||
      this.enemies.countActive(true) >= this.maxActiveEnemies
    ) {
      return;
    }
    const enemyPool = getEnemyPoolForWorld(this.currentWorld.id);
    const sequenceIndex = this.nextEnemyIndex;
    const type = enemyPool[sequenceIndex % enemyPool.length];
    this.nextEnemyIndex += 1;
    const enemy = this.enemies.get() as Enemy | null;
    if (!enemy) {
      return;
    }

    const definition = ENEMIES[type];
    const horizontalPadding = Math.max(105, Math.ceil(definition.displayWidth * 0.55));
    const x = Phaser.Math.Between(horizontalPadding, GAME_WIDTH - horizontalPadding);
    const lanes = bossSupport ? [430, 555] : [350, 470, 590];
    const y = lanes[sequenceIndex % lanes.length];
    this.enemySpawnId += 1;
    enemy.spawn(type, x, y, this.time.now, this.enemySpawnId);

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
      ...POWER_ITEMS
        .filter((def) => def.power !== 'combatBike')
        .map((def) => ({ def, weight: def.weight })),
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
    } else if (power === 'combatBike') {
      this.activateCombatBike(this.time.now + duration);
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
    this.player.setIntegratedBlaster(false);
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
    this.player.setIntegratedBlaster(false);

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
    const { attackPattern, type } = enemy.definition;

    switch (attackPattern) {
      case 'single':
        this.spawnEnemyProjectile(enemy, type, 0);
        break;
      case 'triple':
        [-0.18, 0, 0.18].forEach((offset) => {
          this.spawnEnemyProjectile(enemy, type, offset);
        });
        break;
      case 'dualFire':
        this.spawnEnemyProjectile(enemy, type, -0.11, -12);
        this.spawnEnemyProjectile(enemy, type, 0.11, 14);
        break;
      case 'iceFan':
        [-0.24, 0, 0.24].forEach((offset) => {
          this.spawnEnemyProjectile(enemy, type, offset);
        });
        break;
      case 'machineBurst': {
        const spawnId = enemy.spawnId;
        const burstOffsets = [-0.04, 0.015, -0.02, 0.035];
        burstOffsets.forEach((offset, index) => {
          const fireBurstShot = (): void => {
            if (
              !enemy.active ||
              enemy.spawnId !== spawnId ||
              this.paused ||
              this.gameOver
            ) {
              return;
            }
            this.spawnEnemyProjectile(enemy, type, offset, 0, 0.96 + index * 0.02);
            this.emitMuzzleFlash(
              enemy.x + enemy.definition.muzzleOffsetX * enemy.facingDirection,
              enemy.y + enemy.definition.muzzleOffsetY,
              enemy.definition.color,
            );
          };
          if (index === 0) {
            fireBurstShot();
          } else {
            this.time.delayedCall(index * 105, fireBurstShot);
          }
        });
        break;
      }
      case 'arrowVolley':
        [-0.12, 0, 0.12].forEach((offset, index) => {
          this.spawnEnemyProjectile(enemy, type, offset, (index - 1) * 8, 1 + index * 0.025);
        });
        break;
      case 'divineFan':
        [-0.34, -0.17, 0, 0.17, 0.34].forEach((offset) => {
          this.spawnEnemyProjectile(enemy, type, offset);
        });
        break;
    }

    audioManager.play(type === 'corsair' || type === 'warChickens' ? 'blast' : 'enemy');
    if (attackPattern !== 'machineBurst') {
      this.emitMuzzleFlash(
        enemy.x + enemy.definition.muzzleOffsetX * enemy.facingDirection,
        enemy.y + enemy.definition.muzzleOffsetY,
        enemy.definition.color,
      );
    }
  }

  private spawnEnemyProjectile(
    enemy: Enemy,
    type: EnemyType,
    angleOffset: number,
    muzzleYOffset = 0,
    speedMultiplier = 1,
  ): void {
    const definition = ENEMIES[type];
    const originX = enemy.x + definition.muzzleOffsetX * enemy.facingDirection;
    const originY = enemy.y + definition.muzzleOffsetY + muzzleYOffset;
    const projectile = this.enemyProjectiles.get(
      originX,
      originY,
      definition.projectileTexture,
    ) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) {
      return;
    }

    projectile
      .setTexture(definition.projectileTexture)
      .setActive(true)
      .setVisible(true)
      .setPosition(originX, originY)
      .setDisplaySize(definition.projectileWidth, definition.projectileHeight)
      .setDepth(16)
      .setAlpha(1)
      .setRotation(0)
      .clearTint()
      .setData('enemyType', type)
      .setData('bossProjectile', false)
      .setData('bossName', null)
      .setData('projectileKind', 'enemy');

    const targetLead =
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.x *
      definition.targetLeadSeconds;
    const angle =
      Phaser.Math.Angle.Between(
        originX,
        originY,
        this.player.x + targetLead,
        this.player.y - 38,
      ) + angleOffset;
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(originX, originY);
    body.setAllowGravity(false);
    body.setCircle(0);
    if (definition.projectileWidth / definition.projectileHeight >= 1.7) {
      body.setSize(projectile.width * 0.72, projectile.height * 0.62, true);
      projectile.setRotation(angle);
    } else {
      body.setCircle(Math.min(projectile.width, projectile.height) * 0.36);
    }
    const projectileSpeed =
      definition.projectileSpeed * this.difficultySpeedMultiplier * speedMultiplier;
    body.setVelocity(Math.cos(angle) * projectileSpeed, Math.sin(angle) * projectileSpeed);
    projectile.setAngularVelocity(definition.projectileAngularVelocity);
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

    if (this.combatBike.isActive) {
      const damage = bossProjectile ? 2 : 1;
      const destroyed = this.combatBike.takeHit(damage);
      this.showFloatingText(
        this.player.x,
        this.player.y - 190,
        `MOTO -${damage} BLINDAJE`,
        destroyed ? COLORS_HEX.red : COLORS_HEX.yellow,
      );
      this.emitSparkle(x, y, destroyed ? 0xff4d2e : 0xffd21e);
      this.cameras.main.shake(destroyed ? 260 : 110, destroyed ? 0.016 : 0.007);
      if (destroyed) {
        this.deactivateCombatBike(true);
      }
      return;
    }

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

    if (weaponType === 'historic' || weaponType === 'misil-sabor') {
      const x = enemy.x;
      const y = enemy.y;
      this.recycleProjectile(projectile);
      this.explodeEnemies(
        x,
        y,
        weaponType === 'misil-sabor' ? 195 : 145,
        WEAPONS[weaponType].damage,
        WEAPONS[weaponType].color,
      );
      return;
    }

    if (weaponType === 'modern' || weaponType === 'plasma-neon') {
      this.recycleProjectile(projectile);
    }
    this.damageEnemy(enemy, WEAPONS[weaponType]?.damage ?? 1);
  }

  private explodeEnemies(
    x: number,
    y: number,
    radius = 145,
    damage = 2,
    color = WEAPONS.historic.color,
  ): void {
    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (
        enemy.active &&
        Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius
      ) {
        this.damageEnemy(enemy, damage);
      }
      return true;
    });
    this.emitShockwave(x, y, radius, color);
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
    this.chargeElitePower(18);
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
    projectile
      .setData('bossProjectile', false)
      .setData('projectileKind', 'standard')
      .setData('nextShotAt', Number.POSITIVE_INFINITY)
      .setData('curve', 0);
  }

  private tryFireWeapon(fromFreshPress = false): void {
    if (this.paused || this.gameOver || this.worldTransitioning) {
      return;
    }
    if (this.premiumWeaponActiveUntil > this.time.now) {
      this.tryFirePremiumWeapon(fromFreshPress);
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

    const muzzleX = this.player.x;
    const muzzleY = this.player.y - 150;
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
    } else if (type === 'misil-sabor') {
      projectile.setDisplaySize(50, 68).setAngle(0).setAngularVelocity(0);
      body.setSize(projectile.width * 0.72, projectile.height * 0.82);
    } else if (type === 'poseidon' || type === 'plasma-neon') {
      projectile.setDisplaySize(20, 66).setAngle(velocityX * 0.055).setAngularVelocity(0);
      body.setSize(projectile.width * 0.72, projectile.height * 0.86);
    } else if (type === 'rayo-poseidon') {
      projectile.setDisplaySize(24, 82).setAngle(0).setAngularVelocity(0);
      body.setSize(projectile.width * 0.72, projectile.height * 0.9);
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
    if (type === 'historic' || type === 'misil-sabor') {
      const x = item.x;
      const y = item.y;
      this.recycleProjectile(projectile);
      this.explodeObstacles(x, y, type === 'misil-sabor' ? 190 : 135, WEAPONS[type].color);
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

  private explodeObstacles(
    x: number,
    y: number,
    radius = 135,
    color = WEAPONS.historic.color,
  ): void {
    let destroyed = 0;
    this.items.children.each((child) => {
      const target = child as FallingItem;
      if (
        target.active &&
        target.definition.category === 'bad' &&
        Phaser.Math.Distance.Between(x, y, target.x, target.y) <= radius
      ) {
        this.destroyObstacle(target, destroyed === 0 ? 100 : 75, color);
        destroyed += 1;
      }
      return true;
    });

    this.emitShockwave(x, y, radius, color);
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
    this.player.setIntegratedBlaster(false);
    this.updateHud();
  }

  // ---------------------------------------------------------------------------
  // Membership abilities
  // ---------------------------------------------------------------------------

  private activatePremiumWeapon(): void {
    if (
      !hasActiveMembership(this.membership)
      || this.gameOver
      || this.worldTransitioning
      || this.premiumWeaponUsedWorlds.has(this.currentWorld.id)
    ) {
      if (this.premiumWeaponUsedWorlds.has(this.currentWorld.id)) {
        this.showFloatingText(this.player.x, this.player.y - 150, 'ARMA VIP YA USADA', '#9fdcff');
      }
      return;
    }
    this.premiumWeaponUsedWorlds.add(this.currentWorld.id);
    this.premiumWeaponActiveUntil = this.time.now + 15_000;
    this.nextShotAt = 0;
    const weapon = PREMIUM_WEAPONS[this.membership.selectedWeapon];
    this.pulseAbilityControl(
      this.premiumWeaponControl,
      weapon.color,
      `${weapon.shortName} ACTIVA`,
    );
    this.showFloatingText(
      this.player.x,
      this.player.y - 165,
      `${weapon.shortName} • 15 SEGUNDOS`,
      weapon.colorHex,
    );
    this.emitShockwave(this.player.x, this.player.y - 80, 150, weapon.color);
    audioManager.play('power');
    this.updateMembershipControls();
    this.updateHud();
  }

  private tryFirePremiumWeapon(fromFreshPress = false): void {
    if (!hasActiveMembership(this.membership)) return;
    const type = this.membership.selectedWeapon;
    const weapon = WEAPONS[type];
    if (!fromFreshPress && this.time.now < this.nextShotAt) return;
    this.nextShotAt = this.time.now + weapon.cooldownMs;
    const muzzleX = this.player.x;
    const muzzleY = this.player.y - 150;
    if (type === 'plasma-neon') {
      this.spawnProjectile(muzzleX - 24, muzzleY + 4, type, -135);
      this.spawnProjectile(muzzleX, muzzleY - 8, type, 0);
      this.spawnProjectile(muzzleX + 24, muzzleY + 4, type, 135);
    } else {
      this.spawnProjectile(muzzleX, muzzleY, type, 0);
    }
    this.player.fireRecoil();
    audioManager.play(type === 'misil-sabor' ? 'blast' : 'shot');
    this.emitMuzzleFlash(muzzleX, muzzleY, weapon.color);
  }

  private activatePremiumPlane(): void {
    if (
      !hasActiveMembership(this.membership)
      || this.gameOver
      || this.worldTransitioning
      || this.premiumPlaneUsedWorlds.has(this.currentWorld.id)
    ) {
      if (this.premiumPlaneUsedWorlds.has(this.currentWorld.id)) {
        this.showFloatingText(this.player.x, this.player.y - 150, 'AVION YA USADO', '#9fdcff');
      }
      return;
    }
    this.premiumPlaneUsedWorlds.add(this.currentWorld.id);
    this.premiumPlaneExpiresAt = this.time.now + 10_000;
    this.nextPremiumPlaneShotAt = this.time.now + 120;
    this.premiumPlane?.destroy(true);

    const plane = this.add.container(this.player.x, this.player.y - 190).setDepth(14);
    const halo = this.add
      .ellipse(0, 18, 190, 76, 0x43d9ff, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    const aircraft = this.add.image(0, -16, 'avion-daddy').setDisplaySize(205, 124);
    const label = this.add
      .text(0, 20, 'DADDY AIR', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '16px',
        color: COLORS_HEX.yellow,
        stroke: '#06143a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    plane.add([halo, aircraft, label]);
    plane.setScale(0.72);
    this.premiumPlane = plane;
    this.pulseAbilityControl(
      this.premiumPlaneControl,
      0x43d9ff,
      'ATAQUE AÉREO ACTIVO',
    );
    this.showFloatingText(this.player.x, this.player.y - 225, 'AVION • 10 SEGUNDOS', '#43d9ff');
    this.cameras.main.shake(160, 0.008);
    audioManager.play('power');
    this.updateMembershipControls();
  }

  private updateMembershipAbilities(): void {
    if (!hasActiveMembership(this.membership)) return;
    if (this.premiumWeaponActiveUntil > 0 && this.time.now >= this.premiumWeaponActiveUntil) {
      this.premiumWeaponActiveUntil = 0;
      this.updateHud();
    }
    if (this.premiumPlane && this.premiumPlaneExpiresAt > this.time.now) {
      this.premiumPlane.x = Phaser.Math.Linear(this.premiumPlane.x, this.player.x, 0.15);
      this.premiumPlane.y = this.player.y - 205 + Math.sin(this.time.now * 0.01) * 8;
      if (this.time.now >= this.nextPremiumPlaneShotAt) {
        this.nextPremiumPlaneShotAt = this.time.now + 300;
        this.spawnProjectile(this.premiumPlane.x - 42, this.premiumPlane.y - 20, 'modern', -95);
        this.spawnProjectile(this.premiumPlane.x + 42, this.premiumPlane.y - 20, 'modern', 95);
        this.emitMuzzleFlash(this.premiumPlane.x, this.premiumPlane.y - 25, 0x43d9ff);
      }
    } else if (this.premiumPlane) {
      this.premiumPlane.destroy(true);
      this.premiumPlane = undefined;
      this.premiumPlaneExpiresAt = 0;
      this.showFloatingText(this.player.x, this.player.y - 190, 'AVION AGOTADO', '#9fdcff');
    }
    this.updateMembershipControls();
  }

  private chargeElitePower(amount: number): void {
    if (!isEliteMembership(this.membership) || this.elitePowerUsedWorlds.has(this.currentWorld.id)) {
      return;
    }
    const previous = this.elitePowerCharge;
    this.elitePowerCharge = Phaser.Math.Clamp(this.elitePowerCharge + amount, 0, 100);
    if (previous < 100 && this.elitePowerCharge >= 100) {
      this.showFloatingText(this.player.x, this.player.y - 185, '¡PODER ELITE LISTO!', COLORS_HEX.yellow);
      audioManager.play('power');
    }
    this.updateMembershipControls();
  }

  private activateElitePower(): void {
    if (
      !isEliteMembership(this.membership)
      || this.gameOver
      || this.worldTransitioning
      || this.elitePowerUsedWorlds.has(this.currentWorld.id)
    ) {
      return;
    }
    if (this.elitePowerCharge < 100) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 160,
        `PODER ${Math.round(this.elitePowerCharge)}%`,
        '#9fdcff',
      );
      return;
    }

    this.elitePowerUsedWorlds.add(this.currentWorld.id);
    this.elitePowerCharge = 0;
    const cycle = (this.currentWorld.id - 1) % 3;
    const powerName = cycle === 0 ? 'RAYOS DEL CIELO' : cycle === 1 ? 'FUEGO ARRASADOR' : 'TERREMOTO DADDY';
    const color = cycle === 0 ? 0x9ffcff : cycle === 1 ? 0xff5428 : 0xffd21e;
    const bossDamage = cycle === 0 ? 10 : cycle === 1 ? 12 : 14;

    this.items.children.each((child) => {
      const item = child as FallingItem;
      if (item.active && item.definition.category === 'bad') {
        this.destroyObstacle(item, 85, color);
      }
      return true;
    });
    this.enemies.children.each((child) => {
      const enemy = child as Enemy;
      if (enemy.active) this.damageEnemy(enemy, 99);
      return true;
    });
    this.enemyProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) this.recycleEnemyProjectile(projectile);
      return true;
    });
    this.bossProjectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Image;
      if (projectile.active) this.recycleEnemyProjectile(projectile);
      return true;
    });

    let defeatedGeneral = false;
    if (this.generalActive && this.general.active) {
      defeatedGeneral = this.general.takeHit(bossDamage);
      this.updateGeneralHealthHud();
    }
    const defeatedBosses: Boss[] = [];
    if (this.bossActive) {
      for (const boss of this.getEncounterBosses()) {
        if (boss.active && boss.takeHit(bossDamage)) defeatedBosses.push(boss);
      }
      const encounterBosses = this.getEncounterBosses();
      const totalRatio = encounterBosses.reduce((sum, boss) => sum + boss.healthRatio, 0);
      this.bossHealthFill.setScale(totalRatio / Math.max(1, encounterBosses.length), 1);
    }

    this.showElitePowerEffect(powerName, color, cycle);
    this.pulseAbilityControl(this.elitePowerControl, color, powerName);
    this.updateMembershipControls();
    if (defeatedGeneral) {
      this.time.delayedCall(450, () => this.defeatGeneral());
    } else if (defeatedBosses.length > 0) {
      const encounterFinished = this.getEncounterBosses().every(
        (encounterBoss) => encounterBoss.healthRatio <= 0,
      );
      if (encounterFinished) {
        this.time.delayedCall(450, () => this.defeatBoss());
      } else {
        defeatedBosses.forEach((boss) => this.retireDefeatedBoss(boss));
      }
    }
  }

  private showElitePowerEffect(name: string, color: number, cycle: number): void {
    const powerTexture = [
      'poder-rayos-cielo',
      'poder-fuego-arrasador',
      'poder-terremoto-daddy',
    ][cycle];
    const powerImage = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 145, powerTexture)
      .setDisplaySize(270, 190)
      .setDepth(69)
      .setAlpha(0.82);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, name, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: '52px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#020718',
        strokeThickness: 9,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(70);
    const flash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, color, 0.34)
      .setOrigin(0)
      .setDepth(65);
    if (cycle === 0) {
      for (let x = 85; x < GAME_WIDTH; x += 138) {
        const bolt = this.add.rectangle(x, 320, 13, 640, 0xffffff, 0.9).setDepth(66).setAngle(8);
        this.tweens.add({ targets: bolt, alpha: 0, duration: 420, onComplete: () => bolt.destroy() });
      }
    } else if (cycle === 2) {
      this.cameras.main.shake(850, 0.035);
    } else {
      const fire = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT - 210, '__WHITE', {
        x: { min: -GAME_WIDTH / 2, max: GAME_WIDTH / 2 },
        speedY: { min: -520, max: -220 },
        speedX: { min: -80, max: 80 },
        scale: { start: 1.1, end: 0 },
        lifespan: 900,
        quantity: 55,
        tint: [0xffd21e, 0xff5428, 0xe6262b],
        blendMode: 'ADD',
      }).setDepth(66);
      this.time.delayedCall(950, () => fire.destroy());
    }
    this.tweens.add({
      targets: [title, flash, powerImage],
      alpha: 0,
      scale: 1.18,
      duration: 900,
      ease: 'Cubic.out',
      onComplete: () => {
        title.destroy();
        flash.destroy();
        powerImage.destroy();
      },
    });
    audioManager.play('blast');
  }

  // ---------------------------------------------------------------------------
  // Powers
  // ---------------------------------------------------------------------------

  private activateCombatBike(expiresAt: number): void {
    this.player.setCovering(false);
    this.combatBike.activate(this.player, expiresAt);
    this.nextCombatBikeShotAt = this.time.now + 180;
    this.showFloatingText(
      this.player.x,
      this.player.y - 230,
      '¡MOTO DE COMBATE • 10 SEGUNDOS!',
      COLORS_HEX.yellow,
    );
    this.cameras.main.shake(180, 0.008);
  }

  private fireCombatBikeVolley(): void {
    const y = this.player.y - 128;
    this.spawnProjectile(this.player.x - 34, y, 'modern', -95);
    this.spawnProjectile(this.player.x + 34, y, 'modern', 95);
    this.emitMuzzleFlash(this.player.x - 38, y + 10, 0xffd21e);
    this.emitMuzzleFlash(this.player.x + 38, y + 10, 0x43d9ff);
    audioManager.play('shot');
  }

  private deactivateCombatBike(destroyed: boolean): void {
    if (!this.combatBike.isActive) {
      return;
    }
    const x = this.combatBike.x || this.player.x;
    const y = this.combatBike.y || this.player.y;
    this.activePowers.delete('combatBike');
    this.combatBike.deactivate(this.player, destroyed);
    if (destroyed) {
      this.nextEnemyDamageAt = this.time.now + 850;
      this.emitShockwave(x, y - 60, 165, 0xff4d2e);
      this.emitSparkle(x, y - 60, 0xffd21e);
      this.showFloatingText(x, y - 190, '¡MOTO DESTRUIDA!', COLORS_HEX.red);
      this.cameras.main.shake(360, 0.018);
      audioManager.play('blast');
    } else {
      this.showFloatingText(x, y - 190, 'MOTO AGOTADA • DADDY CONTINÚA', '#9fdcff');
      audioManager.play('power');
    }
    this.updateHud();
  }

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
        } else if (power === 'combatBike') {
          this.deactivateCombatBike(false);
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
      combatBike: '🏍 Moto combate',
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
    const elite = isEliteMembership(this.membership);
    const plus = hasActiveMembership(this.membership) && !elite;
    this.scoreText
      .setText(`${elite ? '◆ ' : plus ? '★ ' : ''}Puntos: ${this.score}`)
      .setColor(elite ? '#8cecff' : plus ? '#ffe36b' : COLORS_HEX.white);
    this.livesText.setText('❤️'.repeat(Math.max(0, this.lives)) || '💀');
    this.comboText.setText(this.comboCount >= 2 ? `Combo: ${this.comboCount}` : '');
    this.worldText
      .setText(
        `MUNDO ${this.currentWorld.id}/${WORLDS.length}  •  ${this.currentWorld.name.toUpperCase()}`,
      )
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
    this.updateMembershipControls();
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
    this.premiumPlane = undefined;
    this.premiumWeaponControl = undefined;
    this.premiumPlaneControl = undefined;
    this.elitePowerControl = undefined;
    this.worldTransitionOverlay = undefined;
    this.worldTransitionTrail = undefined;
    this.worldAmbience = undefined;
  }
}
