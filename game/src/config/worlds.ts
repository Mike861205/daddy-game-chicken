export type BossPattern = 'standard' | 'dual-elemental' | 'atomic-aircraft' | 'alien-carrier';

export interface WorldDefinition {
  id: number;
  name: string;
  subtitle: string;
  backgroundKey: string;
  bossName: string;
  bossTexture: string;
  bossHealth: number;
  bossPoints: number;
  bossPattern?: BossPattern;
  secondaryBossName?: string;
  secondaryBossTexture?: string;
  secondaryProjectileTexture?: string;
  color: number;
  colorHex: string;
  projectileTexture: string;
  attackIntervalMs: number;
  projectileSpeed: number;
}

export const WORLDS: readonly WorldDefinition[] = [
  {
    id: 1,
    name: 'Bahía Neón',
    subtitle: 'El despertar del volcán',
    backgroundKey: 'mundo-1-bahia-neon',
    bossName: 'Rey Brasas',
    bossTexture: 'jefe-mundo-1',
    bossHealth: 26,
    bossPoints: 2500,
    color: 0xff5528,
    colorHex: '#ff6b35',
    projectileTexture: 'ataque-fuego',
    attackIntervalMs: 1650,
    projectileSpeed: 285,
  },
  {
    id: 2,
    name: 'Puerto Corsario',
    subtitle: 'Tormenta de pólvora',
    backgroundKey: 'mundo-2-puerto-corsario',
    bossName: 'Almirante Pico Negro',
    bossTexture: 'jefe-mundo-2',
    bossHealth: 34,
    bossPoints: 3400,
    color: 0xffb347,
    colorHex: '#ffbd59',
    projectileTexture: 'ataque-corsario',
    attackIntervalMs: 1450,
    projectileSpeed: 315,
  },
  {
    id: 3,
    name: 'Templo de Poseidón',
    subtitle: 'El reino sumergido',
    backgroundKey: 'mundo-3-templo-poseidon',
    bossName: 'Leviatán Poseidón',
    bossTexture: 'jefe-mundo-3',
    bossHealth: 42,
    bossPoints: 4300,
    color: 0x21e6e6,
    colorHex: '#52ffff',
    projectileTexture: 'ataque-abisal',
    attackIntervalMs: 1280,
    projectileSpeed: 335,
  },
  {
    id: 4,
    name: 'Pantano Tóxico',
    subtitle: 'La fórmula mutante',
    backgroundKey: 'mundo-4-pantano-toxico',
    bossName: 'Doctor Radiactivo',
    bossTexture: 'jefe-mundo-4',
    bossHealth: 50,
    bossPoints: 5200,
    color: 0x8aff3d,
    colorHex: '#9cff57',
    projectileTexture: 'ataque-fuego',
    attackIntervalMs: 1120,
    projectileSpeed: 355,
  },
  {
    id: 5,
    name: 'Fortaleza Omega',
    subtitle: 'La batalla del vacío',
    backgroundKey: 'mundo-5-fortaleza-omega',
    bossName: 'Emperador Omega',
    bossTexture: 'jefe-mundo-5',
    bossHealth: 62,
    bossPoints: 6500,
    color: 0xc34dff,
    colorHex: '#df79ff',
    projectileTexture: 'ataque-abisal',
    attackIntervalMs: 930,
    projectileSpeed: 385,
  },
  {
    id: 6,
    name: 'Frontera Elemental',
    subtitle: 'El pacto de fuego y hielo',
    backgroundKey: 'mundo-6-frontera-elemental',
    bossName: 'Gemelos del Eclipse',
    bossTexture: 'jefe-mundo-6-fuego',
    secondaryBossName: 'Señor Glaciar',
    secondaryBossTexture: 'jefe-mundo-6-hielo',
    bossHealth: 46,
    bossPoints: 8200,
    bossPattern: 'dual-elemental',
    color: 0xff5b31,
    colorHex: '#ff7448',
    projectileTexture: 'ataque-fuego',
    secondaryProjectileTexture: 'ataque-hielo',
    attackIntervalMs: 1040,
    projectileSpeed: 405,
  },
  {
    id: 7,
    name: 'Base Apocalipsis',
    subtitle: 'Alerta atómica en los cielos',
    backgroundKey: 'mundo-7-base-apocalipsis',
    bossName: 'Bombardero Armagedón',
    bossTexture: 'jefe-mundo-7',
    bossHealth: 82,
    bossPoints: 9400,
    bossPattern: 'atomic-aircraft',
    color: 0xffb31a,
    colorHex: '#ffc247',
    projectileTexture: 'ataque-atomico',
    attackIntervalMs: 980,
    projectileSpeed: 430,
  },
  {
    id: 8,
    name: 'Invasión Alien',
    subtitle: 'La última señal del universo',
    backgroundKey: 'mundo-8-invasion-alien',
    bossName: 'Nave Madre Xal-9',
    bossTexture: 'jefe-mundo-8',
    bossHealth: 98,
    bossPoints: 11200,
    bossPattern: 'alien-carrier',
    color: 0xb94dff,
    colorHex: '#d878ff',
    projectileTexture: 'ataque-alien',
    attackIntervalMs: 820,
    projectileSpeed: 455,
  },
] as const;
