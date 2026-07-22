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
  },
};
