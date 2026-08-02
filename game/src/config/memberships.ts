export type MembershipPlanId = 'daddy-plus' | 'daddy-elite';
export type MembershipStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type OutfitId =
  | 'clasico'
  | 'comandante-neon'
  | 'rey-del-sabor'
  | 'guardian-omega'
  | 'fenix-elemental';
export type PremiumWeaponId = 'plasma-neon' | 'misil-sabor' | 'rayo-poseidon';

export interface MembershipPlanDefinition {
  id: MembershipPlanId;
  name: string;
  price: number;
  color: number;
  colorHex: string;
  accent: number;
  badge: string;
  paymentLink: string;
  productId: string;
  benefits: readonly string[];
}

export interface OutfitDefinition {
  id: OutfitId;
  name: string;
  textureKey: string;
  unlockWorld: number;
  tagline: string;
}

export interface PremiumWeaponDefinition {
  id: PremiumWeaponId;
  name: string;
  shortName: string;
  color: number;
  colorHex: string;
  cooldownMs: number;
  projectileSpeed: number;
  damage: number;
  pattern: 'triple' | 'explosive' | 'piercing';
}

export interface MembershipEntitlement {
  planId: MembershipPlanId | null;
  status: MembershipStatus;
  selectedOutfit: OutfitId;
  selectedWeapon: PremiumWeaponId;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  monthlyBenefit: {
    available: boolean;
    label: string;
    code?: string | null;
    redeemedAt?: string | null;
    period?: string;
  } | null;
}

export const MEMBERSHIP_PLANS: Record<MembershipPlanId, MembershipPlanDefinition> = {
  'daddy-plus': {
    id: 'daddy-plus',
    name: 'DADDY PLUS',
    price: 99,
    color: 0x1450c8,
    colorHex: '#43d9ff',
    accent: 0x21e6c1,
    badge: 'PODER EN CADA MUNDO',
    paymentLink: 'https://buy.stripe.com/00w14m8bz5bPb4n8Q64c80k',
    productId: 'prod_Ux7hZ0O7sUc0hJ',
    benefits: [
      '10% de descuento en cada compra',
      '4 vestimentas: 2 inmediatas + 2 por desbloquear',
      '3 armas exclusivas durante 15 segundos',
      'Avion de combate durante 10 segundos por mundo',
    ],
  },
  'daddy-elite': {
    id: 'daddy-elite',
    name: 'DADDY ELITE',
    price: 149,
    color: 0xe6262b,
    colorHex: '#ffd21e',
    accent: 0xff7b24,
    badge: 'LA EXPERIENCIA COMPLETA',
    paymentLink: 'https://buy.stripe.com/14A28qajH8o1b4n1nE4c80j',
    productId: 'prod_Ux7iNXegfFKWbU',
    benefits: [
      'Todo lo incluido en Daddy Plus',
      '1 papas con pollo chico gratis cada mes',
      '1 refresco de 325 ml gratis cada mes',
      'Poder unico por mundo: rayos, fuego o terremoto',
    ],
  },
};

export const OUTFITS: readonly OutfitDefinition[] = [
  {
    id: 'clasico',
    name: 'Daddy Clasico',
    textureKey: 'daddy-pollo',
    unlockWorld: 0,
    tagline: 'El original',
  },
  {
    id: 'comandante-neon',
    name: 'Comandante Neon',
    textureKey: 'skin-comandante-neon',
    unlockWorld: 0,
    tagline: 'Entrega inmediata',
  },
  {
    id: 'rey-del-sabor',
    name: 'Rey del Sabor',
    textureKey: 'skin-rey-sabor',
    unlockWorld: 0,
    tagline: 'Entrega inmediata',
  },
  {
    id: 'guardian-omega',
    name: 'Guardian Omega',
    textureKey: 'skin-guardian-omega',
    unlockWorld: 5,
    tagline: 'Se desbloquea en Mundo 5',
  },
  {
    id: 'fenix-elemental',
    name: 'Fenix Elemental',
    textureKey: 'skin-fenix-elemental',
    unlockWorld: 6,
    tagline: 'Se desbloquea en Mundo 6',
  },
];

export const PREMIUM_WEAPONS: Record<PremiumWeaponId, PremiumWeaponDefinition> = {
  'plasma-neon': {
    id: 'plasma-neon',
    name: 'TRIDENTE DE PLASMA',
    shortName: 'PLASMA',
    color: 0x21e6c1,
    colorHex: '#21e6c1',
    cooldownMs: 155,
    projectileSpeed: 1080,
    damage: 2,
    pattern: 'triple',
  },
  'misil-sabor': {
    id: 'misil-sabor',
    name: 'MISIL DEL SABOR',
    shortName: 'MISIL',
    color: 0xff7b24,
    colorHex: '#ffb347',
    cooldownMs: 520,
    projectileSpeed: 720,
    damage: 5,
    pattern: 'explosive',
  },
  'rayo-poseidon': {
    id: 'rayo-poseidon',
    name: 'RAYO POSEIDON X',
    shortName: 'RAYO X',
    color: 0x63e8ff,
    colorHex: '#9ffcff',
    cooldownMs: 245,
    projectileSpeed: 1250,
    damage: 3,
    pattern: 'piercing',
  },
};

export const EMPTY_MEMBERSHIP: MembershipEntitlement = {
  planId: null,
  status: 'none',
  selectedOutfit: 'clasico',
  selectedWeapon: 'plasma-neon',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  monthlyBenefit: null,
};

/**
 * Local Vite sessions can exercise every paid feature without Stripe. Vite
 * replaces DEV with false in production builds, so deployed clients continue
 * to depend exclusively on the entitlement returned by the API.
 */
export function withLocalDevelopmentAccess(
  membership: MembershipEntitlement | null | undefined,
): MembershipEntitlement {
  if (!import.meta.env.DEV) {
    return membership ?? { ...EMPTY_MEMBERSHIP };
  }

  const planId = membership?.planId ?? 'daddy-elite';
  return {
    ...membership,
    planId,
    status: 'active',
    selectedOutfit: membership?.selectedOutfit ?? EMPTY_MEMBERSHIP.selectedOutfit,
    selectedWeapon: membership?.selectedWeapon ?? EMPTY_MEMBERSHIP.selectedWeapon,
    currentPeriodEnd: membership?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: membership?.cancelAtPeriodEnd ?? false,
    monthlyBenefit: planId === 'daddy-elite'
      ? membership?.monthlyBenefit ?? {
        available: true,
        label: 'Papas con pollo chico + refresco de 325 ml',
      }
      : null,
  };
}

export function isOutfitAvailable(unlockWorld: number, maxWorldUnlocked: number): boolean {
  return import.meta.env.DEV || maxWorldUnlocked >= unlockWorld;
}

export function hasActiveMembership(
  membership: MembershipEntitlement | null | undefined,
): membership is MembershipEntitlement & { planId: MembershipPlanId } {
  return membership?.status === 'active' && membership.planId !== null;
}

export function isEliteMembership(
  membership: MembershipEntitlement | null | undefined,
): boolean {
  return hasActiveMembership(membership) && membership.planId === 'daddy-elite';
}
