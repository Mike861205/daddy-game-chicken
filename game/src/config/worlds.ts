export interface WorldDefinition {
  id: number;
  name: string;
  subtitle: string;
  backgroundKey: string;
  bossName: string;
  bossTexture: string;
  bossHealth: number;
  bossPoints: number;
  color: number;
  colorHex: string;
  projectileTexture: 'ataque-fuego' | 'ataque-corsario' | 'ataque-abisal';
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
] as const;
