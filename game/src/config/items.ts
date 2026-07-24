/**
 * Definitions of all falling items: good products, bad obstacles and power-ups.
 * `key` is used both as the texture key and the placeholder identifier.
 */

export type ItemCategory = 'good' | 'bad' | 'power' | 'weapon';

export type PowerType = 'shield' | 'double' | 'slow' | 'magnet' | 'combo' | 'combatBike';

export type WeaponType = 'modern' | 'historic' | 'poseidon';

export interface ItemDefinition {
  key: string;
  label: string;
  category: ItemCategory;
  /** Base points for good items. */
  points?: number;
  /** True for special (higher value) products. */
  special?: boolean;
  /** Power type for power-ups. */
  power?: PowerType;
  /** Weapon type for arsenal pickups. */
  weapon?: WeaponType;
  /** Placeholder fill color when the image is missing. */
  color: number;
  /** Relative spawn weight. */
  weight: number;
}

export const GOOD_ITEMS: ItemDefinition[] = [
  { key: 'papas-con-pollo', label: 'Papas con pollo', category: 'good', points: 100, color: 0xffb347, weight: 10 },
  { key: 'daddy-shark', label: 'Daddy Shark', category: 'good', points: 200, special: true, color: 0x1450c8, weight: 5 },
  { key: 'hamburguesa-bbq', label: 'Hamburguesa BBQ', category: 'good', points: 200, special: true, color: 0x9c5a2c, weight: 5 },
  { key: 'alitas-bbq', label: 'Alitas BBQ', category: 'good', points: 100, color: 0xc0392b, weight: 8 },
  { key: 'alitas-mango', label: 'Alitas mango habanero', category: 'good', points: 100, color: 0xf39c12, weight: 8 },
  { key: 'boneless', label: 'Boneless', category: 'good', points: 100, color: 0xe0a96d, weight: 8 },
  { key: 'chicken-bake', label: 'Chicken Bake', category: 'good', points: 200, special: true, color: 0xd9a441, weight: 5 },
  { key: 'dedos-de-queso', label: 'Dedos de queso', category: 'good', points: 100, color: 0xf5d76e, weight: 7 },
  { key: 'jalapenos-queso', label: 'Jalapeños con queso', category: 'good', points: 100, color: 0x2ecc71, weight: 7 },
  { key: 'aros-de-cebolla', label: 'Aros de cebolla', category: 'good', points: 100, color: 0xe8c07d, weight: 7 },
  { key: 'refresco', label: 'Refresco', category: 'good', points: 100, color: 0x2980b9, weight: 8 },
];

export const BAD_ITEMS: ItemDefinition[] = [
  { key: 'comida-quemada', label: 'Comida quemada', category: 'bad', color: 0x2c2c2c, weight: 6 },
  { key: 'pedido-equivocado', label: 'Pedido equivocado', category: 'bad', color: 0x7f8c8d, weight: 5 },
  { key: 'charco-aceite', label: 'Charco de aceite', category: 'bad', color: 0x4b3b0a, weight: 4 },
  { key: 'cono-transito', label: 'Cono de tránsito', category: 'bad', color: 0xe67e22, weight: 4 },
  { key: 'caja-vacia', label: 'Caja vacía', category: 'bad', color: 0xb5651d, weight: 4 },
];

export const POWER_ITEMS: ItemDefinition[] = [
  { key: 'ranch', label: 'Ranch blanco', category: 'power', power: 'shield', color: 0xffffff, weight: 2 },
  { key: 'mango-habanero', label: 'Mango habanero', category: 'power', power: 'double', color: 0xff8c00, weight: 2 },
  { key: 'refresco-frio', label: 'Refresco frío', category: 'power', power: 'slow', color: 0x00bcd4, weight: 2 },
  { key: 'moto-reparto', label: 'Moto de reparto', category: 'power', power: 'magnet', color: 0xe6262b, weight: 1 },
  { key: 'moto-combate-premio', label: 'Moto Daddy de combate', category: 'power', power: 'combatBike', color: 0xffd21e, weight: 1.5 },
  { key: 'combo-daddy', label: 'Combo Daddy', category: 'power', power: 'combo', color: 0xffd21e, weight: 1 },
];

/**
 * Arsenal pickups are spawned on their own cadence so every 60-second match
 * gives the player a chance to try all three weapon families.
 */
export const WEAPON_ITEMS: ItemDefinition[] = [
  {
    key: 'arma-moderna',
    label: 'Bláster moderno',
    category: 'weapon',
    weapon: 'modern',
    color: 0x43d9ff,
    weight: 1,
  },
  {
    key: 'arma-historica',
    label: 'Cañón histórico',
    category: 'weapon',
    weapon: 'historic',
    color: 0xffb347,
    weight: 1,
  },
  {
    key: 'tridente-poseidon',
    label: 'Tridente de Poseidón',
    category: 'weapon',
    weapon: 'poseidon',
    color: 0x21e6e6,
    weight: 1,
  },
];

export const ALL_ITEMS: ItemDefinition[] = [
  ...GOOD_ITEMS,
  ...BAD_ITEMS,
  ...POWER_ITEMS,
  ...WEAPON_ITEMS,
];

/**
 * Extra image keys that are not falling items (backgrounds, logo, player).
 */
export const EXTRA_IMAGE_KEYS = [
  'daddy-pollo',
  'fondo-los-cabos',
  'logo-daddy-game-chicken',
  'moto-combate-daddy',
] as const;

/**
 * Power-up durations in milliseconds.
 */
export const POWER_DURATIONS: Record<PowerType, number> = {
  shield: 5000,
  double: 8000,
  slow: 6000,
  magnet: 5000,
  combo: 6000,
  combatBike: 10000,
};
