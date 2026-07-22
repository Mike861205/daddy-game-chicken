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

new Phaser.Game(config);
