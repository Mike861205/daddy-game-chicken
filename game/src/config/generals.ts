export type GeneralPattern =
  | 'stormBarrage'
  | 'toxicMortar'
  | 'elementalCrossfire'
  | 'cosmicAssault';

export const GENERAL_TRIGGER_PROGRESS = 0.7;

export interface GeneralDefinition {
  worldId: 2 | 4 | 6 | 8;
  name: string;
  title: string;
  textureKey: string;
  pattern: GeneralPattern;
  health: number;
  points: number;
  attackIntervalMs: number;
  projectileSpeed: number;
  projectileTexture: string;
  secondaryProjectileTexture?: string;
  displayWidth: number;
  displayHeight: number;
  baseY: number;
  color: number;
  colorHex: string;
}

export const GENERALS: Readonly<Record<GeneralDefinition['worldId'], GeneralDefinition>> = {
  2: {
    worldId: 2,
    name: 'Almirante Tempestad',
    title: 'General Corsario',
    textureKey: 'general-storm-admiral',
    pattern: 'stormBarrage',
    health: 16,
    points: 1900,
    attackIntervalMs: 1550,
    projectileSpeed: 365,
    projectileTexture: 'ataque-cadena',
    displayWidth: 280,
    displayHeight: 252,
    baseY: 330,
    color: 0x4fb8ff,
    colorHex: '#78cbff',
  },
  4: {
    worldId: 4,
    name: 'Quimera Radiactiva',
    title: 'General del Pantano',
    textureKey: 'general-radioactive-chimera',
    pattern: 'toxicMortar',
    health: 22,
    points: 2900,
    attackIntervalMs: 1375,
    projectileSpeed: 345,
    projectileTexture: 'ataque-toxico-general',
    displayWidth: 286,
    displayHeight: 272,
    baseY: 334,
    color: 0x9cff3d,
    colorHex: '#b7ff73',
  },
  6: {
    worldId: 6,
    name: 'Eclipse Bifronte',
    title: 'General Elemental',
    textureKey: 'general-elemental-eclipse',
    pattern: 'elementalCrossfire',
    health: 28,
    points: 4400,
    attackIntervalMs: 1200,
    projectileSpeed: 400,
    projectileTexture: 'ataque-fuego',
    secondaryProjectileTexture: 'ataque-hielo',
    displayWidth: 270,
    displayHeight: 270,
    baseY: 326,
    color: 0x66e7ff,
    colorHex: '#8df0ff',
  },
  8: {
    worldId: 8,
    name: 'Nova Xal',
    title: 'General Cósmico',
    textureKey: 'general-nova-xal',
    pattern: 'cosmicAssault',
    health: 40,
    points: 6800,
    attackIntervalMs: 1050,
    projectileSpeed: 445,
    projectileTexture: 'ataque-cosmico-general',
    displayWidth: 258,
    displayHeight: 292,
    baseY: 320,
    color: 0xd36cff,
    colorHex: '#e59aff',
  },
};

export function getGeneralForWorld(worldId: number): GeneralDefinition | undefined {
  return GENERALS[worldId as GeneralDefinition['worldId']];
}
