import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants.js';
import { storage } from '../services/storage.js';

/**
 * BootScene: minimal initialization and shared state setup.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  init(): void {
    // Seed the registry with persisted preferences.
    this.registry.set(REGISTRY.soundEnabled, storage.getSoundEnabled());
    this.registry.set(REGISTRY.selectedBranch, storage.getBranch());
    this.registry.set(REGISTRY.nickname, storage.getNickname());
  }

  create(): void {
    this.scene.start(SCENES.Preload);
  }
}
