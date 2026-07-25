import Stripe from 'stripe';
import {
  MembershipPlan,
  MembershipStatus,
  type Membership,
} from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import type { MembershipCheckoutInput } from '../validators/membership.validator.js';

type PublicPlanId = 'daddy-plus' | 'daddy-elite';

const PUBLIC_PLAN_BY_DATABASE: Record<MembershipPlan, PublicPlanId> = {
  DADDY_PLUS: 'daddy-plus',
  DADDY_ELITE: 'daddy-elite',
};

const DATABASE_PLAN_BY_PUBLIC: Record<PublicPlanId, MembershipPlan> = {
  'daddy-plus': MembershipPlan.DADDY_PLUS,
  'daddy-elite': MembershipPlan.DADDY_ELITE,
};

function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new AppError(
      503,
      'STRIPE_NOT_CONFIGURED',
      'Falta agregar la llave secreta de Stripe para confirmar el pago.',
    );
  }
  return new Stripe(env.stripeSecretKey);
}

function statusToPublic(status: MembershipStatus): 'active' | 'past_due' | 'canceled' | 'incomplete' {
  switch (status) {
    case MembershipStatus.ACTIVE:
      return 'active';
    case MembershipStatus.PAST_DUE:
      return 'past_due';
    case MembershipStatus.CANCELED:
      return 'canceled';
    default:
      return 'incomplete';
  }
}

function stripeStatusToDatabase(status: Stripe.Subscription.Status): MembershipStatus {
  if (status === 'active' || status === 'trialing') return MembershipStatus.ACTIVE;
  if (status === 'past_due' || status === 'unpaid' || status === 'paused') {
    return MembershipStatus.PAST_DUE;
  }
  if (status === 'canceled') return MembershipStatus.CANCELED;
  return MembershipStatus.INCOMPLETE;
}

function currentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const compatible = subscription as Stripe.Subscription & {
    current_period_end?: number;
  };
  const unix =
    compatible.current_period_end
    ?? subscription.items.data[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : null;
}

function planFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
  fallback: MembershipPlan = MembershipPlan.DADDY_PLUS,
): MembershipPlan {
  const planId = metadata?.planId;
  return planId === 'daddy-elite'
    ? MembershipPlan.DADDY_ELITE
    : planId === 'daddy-plus'
      ? MembershipPlan.DADDY_PLUS
      : fallback;
}

function planFromStripeProduct(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined,
): MembershipPlan | null {
  const productId = typeof product === 'string' ? product : product?.id;
  if (productId === env.stripeProductDaddyPlus) return MembershipPlan.DADDY_PLUS;
  if (productId === env.stripeProductDaddyElite) return MembershipPlan.DADDY_ELITE;
  return null;
}

async function planFromCheckoutProducts(
  session: Stripe.Checkout.Session,
): Promise<MembershipPlan> {
  const stripe = getStripe();
  const lineItems = session.line_items?.data
    ?? (await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 10,
      expand: ['data.price.product'],
    })).data;
  for (const lineItem of lineItems) {
    const plan = planFromStripeProduct(lineItem.price?.product);
    if (plan) return plan;
  }
  throw AppError.badRequest('El producto pagado no corresponde a una membresia configurada.');
}

function formatMembership(membership: Membership | null) {
  if (!membership) {
    return {
      planId: null,
      status: 'none' as const,
      selectedOutfit: 'clasico' as const,
      selectedWeapon: 'plasma-neon' as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      monthlyBenefit: null,
    };
  }
  const active = membership.status === MembershipStatus.ACTIVE;
  const elite = membership.plan === MembershipPlan.DADDY_ELITE;
  return {
    planId: PUBLIC_PLAN_BY_DATABASE[membership.plan],
    status: statusToPublic(membership.status),
    selectedOutfit: 'clasico' as const,
    selectedWeapon: 'plasma-neon' as const,
    currentPeriodEnd: membership.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
    monthlyBenefit: active && elite
      ? {
        available: true,
        label: 'Papas con pollo chico + Coca-Cola 350 ml',
      }
      : null,
  };
}

export async function getMembershipStatus(phone: string) {
  const player = await prisma.player.findFirst({
    where: { phone },
    orderBy: { updatedAt: 'desc' },
    include: { membership: true },
  });
  return formatMembership(player?.membership ?? null);
}

export async function createMembershipCheckout(input: MembershipCheckoutInput) {
  const existingPlayer = await prisma.player.findFirst({
    where: { phone: input.phone },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  const player = existingPlayer
    ? await prisma.player.update({
      where: { id: existingPlayer.id },
      data: {
        name: input.name,
        nickname: input.avatar,
        phone: input.phone,
      },
      select: { id: true },
    })
    : await prisma.player.create({
      data: {
        name: input.name,
        nickname: input.avatar,
        phone: input.phone,
      },
      select: { id: true },
    });

  const requestedPlan = DATABASE_PLAN_BY_PUBLIC[input.planId];
  await prisma.membership.upsert({
    where: { playerId: player.id },
    create: {
      playerId: player.id,
      plan: requestedPlan,
      pendingPlan: requestedPlan,
      status: MembershipStatus.INCOMPLETE,
    },
    update: {
      pendingPlan: requestedPlan,
    },
  });

  const paymentLink =
    input.planId === 'daddy-plus'
      ? env.stripePaymentLinkDaddyPlus
      : env.stripePaymentLinkDaddyElite;
  const productId =
    input.planId === 'daddy-plus'
      ? env.stripeProductDaddyPlus
      : env.stripeProductDaddyElite;
  const url = new URL(paymentLink);
  url.searchParams.set('client_reference_id', player.id);
  url.searchParams.set('locale', 'es');
  url.searchParams.set('utm_source', 'daddy_game_chicken');
  url.searchParams.set('utm_campaign', input.planId);

  return {
    url: url.toString(),
    playerId: player.id,
    productId,
  };
}

async function upsertCheckoutMembership(session: Stripe.Checkout.Session): Promise<void> {
  const playerId = session.client_reference_id ?? session.metadata?.playerId;
  if (!playerId) return;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;
  const plan = await planFromCheckoutProducts(session);
  await prisma.membership.upsert({
    where: { playerId },
    create: {
      playerId,
      plan,
      pendingPlan: null,
      status: MembershipStatus.ACTIVE,
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
    },
    update: {
      plan,
      pendingPlan: null,
      status: MembershipStatus.ACTIVE,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
    },
  });
}

async function updateSubscriptionMembership(subscription: Stripe.Subscription): Promise<void> {
  const existing = await prisma.membership.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        ...(typeof subscription.customer === 'string'
          ? [{ stripeCustomerId: subscription.customer }]
          : []),
      ],
    },
  });
  const playerId = subscription.metadata.playerId ?? existing?.playerId;
  if (!playerId) return;
  const productPlan = subscription.items.data
    .map((item) => planFromStripeProduct(item.price.product))
    .find((candidate): candidate is MembershipPlan => candidate !== null);
  const plan = productPlan ?? planFromMetadata(
    subscription.metadata,
    existing?.pendingPlan ?? existing?.plan,
  );
  await prisma.membership.upsert({
    where: { playerId },
    create: {
      playerId,
      plan,
      pendingPlan: null,
      status: stripeStatusToDatabase(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      currentPeriodEnd: currentPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      plan,
      pendingPlan: null,
      status: stripeStatusToDatabase(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      currentPeriodEnd: currentPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function confirmMembershipCheckout(sessionId: string, phone: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product'],
  });
  if (
    session.status !== 'complete'
    || (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required')
  ) {
    throw AppError.badRequest('El pago de Stripe todavia no esta confirmado.');
  }
  await upsertCheckoutMembership(session);
  return getMembershipStatus(phone);
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | string[] | undefined,
): Promise<void> {
  if (!env.stripeWebhookSecret) {
    throw new AppError(
      503,
      'STRIPE_WEBHOOK_NOT_CONFIGURED',
      'Falta configurar el secreto del webhook de Stripe.',
    );
  }
  if (!signature || Array.isArray(signature)) {
    throw AppError.badRequest('Firma de Stripe ausente.');
  }
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch {
    throw AppError.badRequest('Firma de Stripe invalida.');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (
      session.payment_status === 'paid'
      || session.payment_status === 'no_payment_required'
    ) {
      await upsertCheckoutMembership(session);
    }
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    await upsertCheckoutMembership(event.data.object);
  } else if (
    event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    await updateSubscriptionMembership(event.data.object);
  }
}
