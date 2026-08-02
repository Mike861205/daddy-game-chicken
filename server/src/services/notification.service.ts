import { Prisma } from '@prisma/client';
import webpush from 'web-push';
import { prisma } from '../config/prisma.js';
import type {
  NotificationCampaignInput,
  PushSubscriptionInput,
} from '../validators/notification.validator.js';

const VAPID_CONFIG_KEY = 'push-vapid-keys';
const VAPID_SUBJECT = 'mailto:notificaciones@daddygame.systemdem.online';

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

function parseVapidKeys(value: Prisma.JsonValue | undefined): StoredVapidKeys | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const publicKey = value.publicKey;
  const privateKey = value.privateKey;
  return typeof publicKey === 'string' && typeof privateKey === 'string'
    ? { publicKey, privateKey }
    : null;
}

async function getVapidKeys(): Promise<StoredVapidKeys> {
  const existing = await prisma.gameConfiguration.findUnique({
    where: { key: VAPID_CONFIG_KEY },
    select: { value: true },
  });
  const stored = parseVapidKeys(existing?.value);
  if (stored) return stored;

  const generated = webpush.generateVAPIDKeys();
  try {
    const saved = await prisma.gameConfiguration.create({
      data: {
        key: VAPID_CONFIG_KEY,
        value: {
          publicKey: generated.publicKey,
          privateKey: generated.privateKey,
        },
      },
      select: { value: true },
    });
    return parseVapidKeys(saved.value) ?? generated;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const concurrent = await prisma.gameConfiguration.findUniqueOrThrow({
      where: { key: VAPID_CONFIG_KEY },
      select: { value: true },
    });
    return parseVapidKeys(concurrent.value) ?? generated;
  }
}

function configureWebPush(keys: StoredVapidKeys): void {
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
}

export async function getPushPublicConfiguration() {
  const keys = await getVapidKeys();
  return { enabled: true, publicKey: keys.publicKey };
}

export async function savePushSubscription(
  input: PushSubscriptionInput,
  userAgent: string | undefined,
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      phone: input.phone ?? null,
      installed: input.installed,
      userAgent: userAgent?.slice(0, 500) ?? null,
      active: true,
    },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      phone: input.phone ?? null,
      installed: input.installed,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
    select: { id: true, active: true, installed: true },
  });
}

export async function getNotificationSummary() {
  const [
    registeredPlayers,
    activeSubscriptions,
    installedSubscriptions,
    browserSubscriptions,
    subscribedPhones,
    campaigns,
  ] = await Promise.all([
    prisma.player.count({ where: { phone: { not: null } } }),
    prisma.pushSubscription.count({ where: { active: true } }),
    prisma.pushSubscription.count({ where: { active: true, installed: true } }),
    prisma.pushSubscription.count({ where: { active: true, installed: false } }),
    prisma.pushSubscription.findMany({
      where: { active: true, phone: { not: null } },
      distinct: ['phone'],
      select: { phone: true },
    }),
    prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        message: true,
        kind: true,
        audience: true,
        recipientCount: true,
        deliveredCount: true,
        failedCount: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    enabled: true,
    registeredPlayers,
    activeSubscriptions,
    installedSubscriptions,
    browserSubscriptions,
    registeredWithoutPush: Math.max(0, registeredPlayers - subscribedPhones.length),
    campaigns,
  };
}

export async function sendNotificationCampaign(input: NotificationCampaignInput) {
  const keys = await getVapidKeys();
  configureWebPush(keys);

  const installedFilter =
    input.audience === 'INSTALLED'
      ? { installed: true }
      : input.audience === 'BROWSER'
        ? { installed: false }
        : {};

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { active: true, ...installedFilter },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const campaign = await prisma.notificationCampaign.create({
    data: {
      title: input.title,
      message: input.message,
      targetUrl: input.targetUrl,
      kind: input.kind,
      audience: input.audience,
      recipientCount: subscriptions.length,
    },
    select: { id: true },
  });

  const payload = JSON.stringify({
    title: input.title,
    body: input.message,
    url: input.targetUrl,
    tag: `daddy-pollo-${input.kind.toLowerCase()}-${campaign.id}`,
  });

  let deliveredCount = 0;
  let failedCount = 0;
  const inactiveIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: input.kind === 'PROMOTION' ? 24 * 60 * 60 : 6 * 60 * 60 },
        );
        deliveredCount += 1;
      } catch (error) {
        failedCount += 1;
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) inactiveIds.push(subscription.id);
      }
    }),
  );

  await prisma.$transaction([
    prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: { deliveredCount, failedCount },
    }),
    ...(inactiveIds.length > 0
      ? [
          prisma.pushSubscription.updateMany({
            where: { id: { in: inactiveIds } },
            data: { active: false },
          }),
        ]
      : []),
  ]);

  return {
    id: campaign.id,
    recipientCount: subscriptions.length,
    deliveredCount,
    failedCount,
  };
}
