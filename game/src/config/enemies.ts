export type EnemyType =
  | 'fire'
  | 'corsair'
  | 'abyss'
  | 'twoHeadedDragon'
  | 'iceSubmarine'
  | 'warChickens'
  | 'centaur'
  | 'ancientMedusa';

export type EnemyAttackPattern =
  | 'single'
  | 'triple'
  | 'dualFire'
  | 'iceFan'
  | 'machineBurst'
  | 'arrowVolley'
  | 'divineFan';

export type EnemyMovementPattern =
  | 'hover'
  | 'swoop'
  | 'submarine'
  | 'gunship'
  | 'gallop'
  | 'divine';

export interface EnemyDefinition {
  type: EnemyType;
  label: string;
  textureKey: string;
  idleFrame?: number;
  attackFrame?: number;
  displayWidth: number;
  displayHeight: number;
  bodyWidthRatio: number;
  bodyHeightRatio: number;
  movementPattern: EnemyMovementPattern;
  hoverAmplitude: number;
  movementFrequency: number;
  tiltAmplitude: number;
  health: number;
  points: number;
  patrolSpeed: number;
  shootIntervalMs: number;
  lifetimeMs: number;
  attackPattern: EnemyAttackPattern;
  projectileSpeed: number;
  projectileTexture: string;
  projectileWidth: number;
  projectileHeight: number;
  projectileAngularVelocity: number;
  targetLeadSeconds: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
  color: number;
  colorHex: string;
  introducedInWorld: number;
}

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  fire: {
    type: 'fire',
    label: 'GUARDIÁN VOLCÁNICO',
    textureKey: 'enemigos-anim',
    idleFrame: 0,
    attackFrame: 3,
    displayWidth: 132,
    displayHeight: 132,
    bodyWidthRatio: 0.56,
    bodyHeightRatio: 0.58,
    movementPattern: 'hover',
    hoverAmplitude: 18,
    movementFrequency: 0.0048,
    tiltAmplitude: 3.5,
    health: 3,
    points: 350,
    patrolSpeed: 105,
    shootIntervalMs: 2050,
    lifetimeMs: 15500,
    attackPattern: 'single',
    projectileSpeed: 360,
    projectileTexture: 'ataque-fuego',
    projectileWidth: 40,
    projectileHeight: 40,
    projectileAngularVelocity: 150,
    targetLeadSeconds: 0,
    muzzleOffsetX: 18,
    muzzleOffsetY: 28,
    color: 0xff6b1a,
    colorHex: '#ff8a2a',
    introducedInWorld: 1,
  },
  corsair: {
    type: 'corsair',
    label: 'CORSARIO AÉREO',
    textureKey: 'enemigos-anim',
    idleFrame: 1,
    attackFrame: 4,
    displayWidth: 132,
    displayHeight: 132,
    bodyWidthRatio: 0.56,
    bodyHeightRatio: 0.58,
    movementPattern: 'hover',
    hoverAmplitude: 18,
    movementFrequency: 0.0048,
    tiltAmplitude: 3.5,
    health: 4,
    points: 500,
    patrolSpeed: 135,
    shootIntervalMs: 1750,
    lifetimeMs: 15500,
    attackPattern: 'single',
    projectileSpeed: 440,
    projectileTexture: 'ataque-corsario',
    projectileWidth: 36,
    projectileHeight: 36,
    projectileAngularVelocity: 280,
    targetLeadSeconds: 0.16,
    muzzleOffsetX: 22,
    muzzleOffsetY: 30,
    color: 0xffb347,
    colorHex: '#ffd16a',
    introducedInWorld: 1,
  },
  abyss: {
    type: 'abyss',
    label: 'GUERRERO ABISAL',
    textureKey: 'enemigos-anim',
    idleFrame: 2,
    attackFrame: 5,
    displayWidth: 132,
    displayHeight: 132,
    bodyWidthRatio: 0.56,
    bodyHeightRatio: 0.58,
    movementPattern: 'hover',
    hoverAmplitude: 18,
    movementFrequency: 0.0048,
    tiltAmplitude: 3.5,
    health: 5,
    points: 650,
    patrolSpeed: 88,
    shootIntervalMs: 2350,
    lifetimeMs: 15500,
    attackPattern: 'triple',
    projectileSpeed: 330,
    projectileTexture: 'ataque-abisal',
    projectileWidth: 40,
    projectileHeight: 40,
    projectileAngularVelocity: 0,
    targetLeadSeconds: 0,
    muzzleOffsetX: 20,
    muzzleOffsetY: 28,
    color: 0x21e6e6,
    colorHex: '#64f4ff',
    introducedInWorld: 1,
  },
  twoHeadedDragon: {
    type: 'twoHeadedDragon',
    label: 'DRAGÓN BICÉFALO',
    textureKey: 'enemy-two-headed-dragon',
    displayWidth: 184,
    displayHeight: 120,
    bodyWidthRatio: 0.68,
    bodyHeightRatio: 0.58,
    movementPattern: 'swoop',
    hoverAmplitude: 34,
    movementFrequency: 0.0035,
    tiltAmplitude: 7,
    health: 6,
    points: 850,
    patrolSpeed: 118,
    shootIntervalMs: 1900,
    lifetimeMs: 17000,
    attackPattern: 'dualFire',
    projectileSpeed: 420,
    projectileTexture: 'ataque-fuego',
    projectileWidth: 44,
    projectileHeight: 44,
    projectileAngularVelocity: 190,
    targetLeadSeconds: 0.08,
    muzzleOffsetX: 55,
    muzzleOffsetY: 8,
    color: 0xff4a22,
    colorHex: '#ff714f',
    introducedInWorld: 2,
  },
  iceSubmarine: {
    type: 'iceSubmarine',
    label: 'SUBMARINO GLACIAL',
    textureKey: 'enemy-ice-submarine',
    displayWidth: 184,
    displayHeight: 114,
    bodyWidthRatio: 0.74,
    bodyHeightRatio: 0.56,
    movementPattern: 'submarine',
    hoverAmplitude: 11,
    movementFrequency: 0.0028,
    tiltAmplitude: 2.2,
    health: 7,
    points: 1000,
    patrolSpeed: 94,
    shootIntervalMs: 2050,
    lifetimeMs: 18000,
    attackPattern: 'iceFan',
    projectileSpeed: 370,
    projectileTexture: 'ataque-hielo',
    projectileWidth: 42,
    projectileHeight: 42,
    projectileAngularVelocity: 90,
    targetLeadSeconds: 0.06,
    muzzleOffsetX: 74,
    muzzleOffsetY: 8,
    color: 0x40dfff,
    colorHex: '#8ff7ff',
    introducedInWorld: 3,
  },
  warChickens: {
    type: 'warChickens',
    label: 'PATRULLA GALLINÁCEA',
    textureKey: 'enemy-war-chickens',
    displayWidth: 192,
    displayHeight: 142,
    bodyWidthRatio: 0.72,
    bodyHeightRatio: 0.54,
    movementPattern: 'gunship',
    hoverAmplitude: 8,
    movementFrequency: 0.0062,
    tiltAmplitude: 3,
    health: 8,
    points: 1250,
    patrolSpeed: 152,
    shootIntervalMs: 1850,
    lifetimeMs: 17000,
    attackPattern: 'machineBurst',
    projectileSpeed: 545,
    projectileTexture: 'ataque-metralla',
    projectileWidth: 34,
    projectileHeight: 12,
    projectileAngularVelocity: 0,
    targetLeadSeconds: 0.2,
    muzzleOffsetX: 82,
    muzzleOffsetY: -24,
    color: 0xffd45c,
    colorHex: '#ffe27d',
    introducedInWorld: 4,
  },
  centaur: {
    type: 'centaur',
    label: 'CENTAURO CELESTIAL',
    textureKey: 'enemy-centaur',
    displayWidth: 176,
    displayHeight: 152,
    bodyWidthRatio: 0.58,
    bodyHeightRatio: 0.72,
    movementPattern: 'gallop',
    hoverAmplitude: 12,
    movementFrequency: 0.007,
    tiltAmplitude: 4.5,
    health: 9,
    points: 1500,
    patrolSpeed: 172,
    shootIntervalMs: 1750,
    lifetimeMs: 16500,
    attackPattern: 'arrowVolley',
    projectileSpeed: 570,
    projectileTexture: 'ataque-flecha',
    projectileWidth: 58,
    projectileHeight: 18,
    projectileAngularVelocity: 0,
    targetLeadSeconds: 0.28,
    muzzleOffsetX: 72,
    muzzleOffsetY: -28,
    color: 0x39e6cb,
    colorHex: '#62f4de',
    introducedInWorld: 5,
  },
  ancientMedusa: {
    type: 'ancientMedusa',
    label: 'MEDUSA ANCESTRAL',
    textureKey: 'enemy-ancient-medusa',
    displayWidth: 126,
    displayHeight: 194,
    bodyWidthRatio: 0.62,
    bodyHeightRatio: 0.78,
    movementPattern: 'divine',
    hoverAmplitude: 31,
    movementFrequency: 0.0031,
    tiltAmplitude: 6,
    health: 11,
    points: 1850,
    patrolSpeed: 84,
    shootIntervalMs: 2250,
    lifetimeMs: 19000,
    attackPattern: 'divineFan',
    projectileSpeed: 335,
    projectileTexture: 'ataque-divino',
    projectileWidth: 46,
    projectileHeight: 46,
    projectileAngularVelocity: 220,
    targetLeadSeconds: 0.1,
    muzzleOffsetX: 40,
    muzzleOffsetY: -5,
    color: 0xd274ff,
    colorHex: '#e6a1ff',
    introducedInWorld: 6,
  },
};

/**
 * Each world keeps a readable enemy identity while progressively introducing
 * the five advanced rivals. Later worlds deliberately favor the harder types.
 */
export const WORLD_ENEMY_POOLS: Readonly<Record<number, readonly EnemyType[]>> = {
  1: ['fire', 'corsair', 'abyss'],
  2: ['fire', 'corsair', 'abyss', 'twoHeadedDragon'],
  3: ['corsair', 'abyss', 'twoHeadedDragon', 'iceSubmarine'],
  4: ['fire', 'abyss', 'twoHeadedDragon', 'iceSubmarine', 'warChickens'],
  5: ['corsair', 'twoHeadedDragon', 'warChickens', 'centaur'],
  6: ['fire', 'iceSubmarine', 'twoHeadedDragon', 'centaur', 'ancientMedusa'],
  7: ['corsair', 'warChickens', 'centaur', 'ancientMedusa'],
  8: [
    'abyss',
    'twoHeadedDragon',
    'iceSubmarine',
    'warChickens',
    'centaur',
    'ancientMedusa',
  ],
};

export function getEnemyPoolForWorld(worldId: number): readonly EnemyType[] {
  const normalizedWorldId = Math.min(8, Math.max(1, Math.round(worldId)));
  return WORLD_ENEMY_POOLS[normalizedWorldId];
}
