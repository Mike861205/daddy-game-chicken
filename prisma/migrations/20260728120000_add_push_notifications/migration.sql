CREATE TYPE "NotificationAudience" AS ENUM ('ALL', 'INSTALLED', 'BROWSER');
CREATE TYPE "NotificationKind" AS ENUM ('REMINDER', 'PROMOTION');

CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "phone" TEXT,
  "installed" BOOLEAN NOT NULL DEFAULT false,
  "userAgent" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_campaigns" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL DEFAULT '/',
  "kind" "NotificationKind" NOT NULL,
  "audience" "NotificationAudience" NOT NULL,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_phone_idx" ON "push_subscriptions"("phone");
CREATE INDEX "push_subscriptions_active_idx" ON "push_subscriptions"("active");
CREATE INDEX "push_subscriptions_installed_idx" ON "push_subscriptions"("installed");
CREATE INDEX "notification_campaigns_createdAt_idx" ON "notification_campaigns"("createdAt");
