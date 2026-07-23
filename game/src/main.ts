import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { InstructionsScene } from './scenes/InstructionsScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';
import './styles/main.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a2a6c',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // Enable DOM elements for the nickname input in ResultScene.
  dom: {
    createContainer: true,
  },
  input: {
    // Four active pointers allow moving, covering and firing at the same time
    // on phones and tablets without one finger cancelling another.
    activePointers: 4,
    touch: {
      capture: true,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  fps: {
    target: 60,
    // Phaser schedules the next setTimeout tick before running the current
    // frame. Unlike its RAF path, an isolated callback error cannot cancel the
    // complete game loop and leave a permanent frozen canvas.
    forceSetTimeOut: true,
    smoothStep: true,
  },
  // Pause rendering/logic when the tab is hidden to save resources.
  autoFocus: true,
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    InstructionsScene,
    GameScene,
    ResultScene,
    LeaderboardScene,
  ],
};

const game = new Phaser.Game(config);

// Keep pointer hit-testing aligned with the visually centered canvas.
// Phaser's Scale Manager caches the canvas bounds and only recomputes them on
// resize/scroll. Layout shifts that don't fire those events (e.g. the browser
// bookmarks bar rendering, tab focus changes) can leave the cached bounds
// stale, which makes buttons feel unresponsive until you move around or click
// several times. Refresh the bounds on the relevant events and shortly after
// the game boots so the first interactions register correctly.
const refreshBounds = (): void => {
  game.scale.refresh();
};
window.addEventListener('resize', refreshBounds);
window.addEventListener('scroll', refreshBounds, true);
window.addEventListener('orientationchange', refreshBounds);
window.addEventListener('focus', refreshBounds);
document.addEventListener('visibilitychange', refreshBounds);
game.events.once('ready', () => {
  refreshBounds();
  window.setTimeout(refreshBounds, 100);
  window.setTimeout(refreshBounds, 600);
});
