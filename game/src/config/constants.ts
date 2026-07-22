/**
 * Brand palette for Daddy Pollo.
 */
export const COLORS = {
  blue: 0x0a2a6c,
  blueLight: 0x1450c8,
  yellow: 0xffd21e,
  red: 0xe6262b,
  neon: 0x21e6c1,
  white: 0xffffff,
  black: 0x000000,
  green: 0x27c93f,
  shadow: 0x000000,
} as const;

export const COLORS_HEX = {
  blue: '#0a2a6c',
  blueLight: '#1450c8',
  yellow: '#ffd21e',
  red: '#e6262b',
  neon: '#21e6c1',
  white: '#ffffff',
  green: '#27c93f',
} as const;

/**
 * Logical game resolution. The Scale manager fits this to any device.
 */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

/**
 * Scene keys used across the game.
 */
export const SCENES = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Instructions: 'InstructionsScene',
  Game: 'GameScene',
  Result: 'ResultScene',
  Leaderboard: 'LeaderboardScene',
} as const;

/**
 * Registry keys for shared game state.
 */
export const REGISTRY = {
  soundEnabled: 'soundEnabled',
  selectedBranch: 'selectedBranch',
  lastResult: 'lastResult',
  publicConfig: 'publicConfig',
  nickname: 'nickname',
} as const;
