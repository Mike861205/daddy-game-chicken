export type EnemyType = 'fire' | 'corsair' | 'abyss';

export interface EnemyDefinition {
  type: EnemyType;
  label: string;
  idleFrame: number;
  attackFrame: number;
  health: number;
  points: number;
  patrolSpeed: number;
  shootIntervalMs: number;
  projectileSpeed: number;
  projectileTexture: string;
  color: number;
  colorHex: string;
}

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  fire: {
    type: 'fire',
    label: 'GUARDIÁN VOLCÁNICO',
    idleFrame: 0,
    attackFrame: 3,
    health: 3,
    points: 350,
    patrolSpeed: 105,
    shootIntervalMs: 2050,
    projectileSpeed: 360,
    projectileTexture: 'ataque-fuego',
    color: 0xff6b1a,
    colorHex: '#ff8a2a',
  },
  corsair: {
    type: 'corsair',
    label: 'CORSARIO AÉREO',
    idleFrame: 1,
    attackFrame: 4,
    health: 4,
    points: 500,
    patrolSpeed: 135,
    shootIntervalMs: 1750,
    projectileSpeed: 440,
    projectileTexture: 'ataque-corsario',
    color: 0xffb347,
    colorHex: '#ffd16a',
  },
  abyss: {
    type: 'abyss',
    label: 'GUERRERO ABISAL',
    idleFrame: 2,
    attackFrame: 5,
    health: 5,
    points: 650,
    patrolSpeed: 88,
    shootIntervalMs: 2350,
    projectileSpeed: 330,
    projectileTexture: 'ataque-abisal',
    color: 0x21e6e6,
    colorHex: '#64f4ff',
  },
};

export const ENEMY_ORDER: EnemyType[] = ['fire', 'corsair', 'abyss'];
