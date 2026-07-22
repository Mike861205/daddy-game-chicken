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
  type ItemDefinition,
  type PowerType,
} from '../config/items.js';
import { FallingItem } from '../objects/FallingItem.js';
import { Player } from '../objects/Player.js';
import { audioManager } from '../services/audio.js';
import { generateUuid } from '../utils/uuid.js';
import type { GameResult, PublicConfig } from '../types.js';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
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

  private activePowers = new Map<PowerType, number>();

  // HUD.
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;

  // Timers.
  private spawnTimer?: Phaser.Time.TimerEvent;
  private countdownTimer?: Phaser.Time.TimerEvent;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  private leftPressed = false;
  private rightPressed = false;
  private dragging = false;

  private visibilityHandler?: () => void;

  constructor() {
    super(SCENES.Game);
  }

  create(): void {
    this.resetState();
    this.config = this.registry.get(REGISTRY.publicConfig) as PublicConfig;
    this.timeLeft = this.config.durationSeconds;
    this.lives = this.config.startingLives;

    this.drawBackground();
    this.createPlayer();
    this.createItemsGroup();
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
    this.leftPressed = false;
    this.rightPressed = false;
    this.dragging = false;
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

    // Ground line.
    const ground = this.add.graphics();
    ground.fillStyle(COLORS.yellow, 1);
    ground.fillRect(0, GAME_HEIGHT - 130, GAME_WIDTH, 8);
  }

  private createPlayer(): void {
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT - 150);
    this.player.setDepth(5);
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

    this.updateHud();
  }

  private createKeyboardControls(): void {
    if (!this.input.keyboard) {
      return;
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  private createTouchControls(): void {
    // Large left/right touch buttons at the bottom corners.
    const btnY = GAME_HEIGHT - 90;
    const leftBtn = this.makeControlButton(90, btnY, '◀');
    const rightBtn = this.makeControlButton(GAME_WIDTH - 90, btnY, '▶');

    leftBtn.on('pointerdown', () => (this.leftPressed = true));
    leftBtn.on('pointerup', () => (this.leftPressed = false));
    leftBtn.on('pointerout', () => (this.leftPressed = false));
    rightBtn.on('pointerdown', () => (this.rightPressed = true));
    rightBtn.on('pointerup', () => (this.rightPressed = false));
    rightBtn.on('pointerout', () => (this.rightPressed = false));

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

  update(): void {
    if (this.paused || this.gameOver) {
      return;
    }

    // Keyboard / touch movement.
    const left = this.leftPressed || this.cursors?.left.isDown || this.keyA?.isDown;
    const right = this.rightPressed || this.cursors?.right.isDown || this.keyD?.isDown;

    if (!this.dragging) {
      if (left && !right) {
        this.player.moveLeft();
      } else if (right && !left) {
        this.player.moveRight();
      } else {
        this.player.stopMoving();
      }
    }
    this.player.update();

    // Magnet power: pull good items toward the player.
    const magnetActive = this.isPowerActive('magnet');

    this.items.children.each((child) => {
      const item = child as FallingItem;
      if (!item.active) {
        return true;
      }
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
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    const slowFactor = this.isPowerActive('slow') ? 0.55 : 1;
    const speed = (this.baseFallSpeed + Phaser.Math.Between(-30, 60)) * slowFactor;

    const item = this.items.get() as FallingItem | null;
    if (!item) {
      return;
    }
    item.spawn(definition, x, speed);
  }

  private pickItem(): ItemDefinition {
    // Weighted pool: mostly good, some bad, rare powers.
    const pool: { def: ItemDefinition; weight: number }[] = [
      ...GOOD_ITEMS.map((def) => ({ def, weight: def.weight })),
      ...BAD_ITEMS.map((def) => ({ def, weight: def.weight })),
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

    const points = base * multiplier;
    this.score += points;

    audioManager.play(multiplier > 1 ? 'combo' : 'catch');
    this.showFloatingText(x, y, `+${points}`, multiplier > 1 ? COLORS_HEX.neon : COLORS_HEX.yellow);
    this.emitSparkle(x, y, def.color);

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

  private onMiss(item: FallingItem): void {
    const wasGood = item.definition.category === 'good';
    item.recycle();
    if (wasGood) {
      this.missedItems += 1;
      this.comboCount = 0;
      this.updateHud();
    }
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
    this.input.removeAllListeners();
  }
}
