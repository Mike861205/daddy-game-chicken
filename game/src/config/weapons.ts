import type { WeaponType } from './items.js';

export interface WeaponDefinition {
  type: WeaponType;
  label: string;
  shortLabel: string;
  textureKey: string;
  projectileTexture: string;
  ammo: number;
  cooldownMs: number;
  projectileSpeed: number;
  color: number;
  colorHex: string;
  damage: number;
}

export const WEAPONS: Record<WeaponType, WeaponDefinition> = {
  modern: {
    type: 'modern',
    label: 'BLÁSTER MODERNO',
    shortLabel: 'BLÁSTER',
    textureKey: 'arma-moderna',
    projectileTexture: 'bala-moderna',
    ammo: 48,
    cooldownMs: 140,
    projectileSpeed: 920,
    color: 0x43d9ff,
    colorHex: '#43d9ff',
    damage: 1,
  },
  historic: {
    type: 'historic',
    label: 'CAÑÓN HISTÓRICO',
    shortLabel: 'CAÑÓN',
    textureKey: 'arma-historica',
    projectileTexture: 'bala-historica',
    ammo: 9,
    cooldownMs: 520,
    projectileSpeed: 650,
    color: 0xffb347,
    colorHex: '#ffb347',
    damage: 3,
  },
  poseidon: {
    type: 'poseidon',
    label: 'TRIDENTE DE POSEIDÓN',
    shortLabel: 'POSEIDÓN',
    textureKey: 'tridente-poseidon',
    projectileTexture: 'bala-poseidon',
    ammo: 15,
    cooldownMs: 290,
    projectileSpeed: 820,
    color: 0x21e6e6,
    colorHex: '#21e6e6',
    damage: 2,
  },
  'plasma-neon': {
    type: 'plasma-neon',
    label: 'TRIDENTE DE PLASMA',
    shortLabel: 'PLASMA VIP',
    textureKey: 'arma-moderna',
    projectileTexture: 'bala-plasma-neon',
    ammo: 999,
    cooldownMs: 155,
    projectileSpeed: 1080,
    color: 0x21e6c1,
    colorHex: '#21e6c1',
    damage: 2,
  },
  'misil-sabor': {
    type: 'misil-sabor',
    label: 'MISIL DEL SABOR',
    shortLabel: 'MISIL VIP',
    textureKey: 'arma-historica',
    projectileTexture: 'bala-misil-sabor',
    ammo: 999,
    cooldownMs: 520,
    projectileSpeed: 720,
    color: 0xff7b24,
    colorHex: '#ffb347',
    damage: 5,
  },
  'rayo-poseidon': {
    type: 'rayo-poseidon',
    label: 'RAYO POSEIDON X',
    shortLabel: 'RAYO X VIP',
    textureKey: 'tridente-poseidon',
    projectileTexture: 'bala-rayo-vip',
    ammo: 999,
    cooldownMs: 245,
    projectileSpeed: 1250,
    color: 0x63e8ff,
    colorHex: '#9ffcff',
    damage: 3,
  },
};
