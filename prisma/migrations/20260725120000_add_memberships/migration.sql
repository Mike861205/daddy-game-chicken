CREATE TYPE "MembershipPlan" AS ENUM ('DADDY_PLUS', 'DADDY_ELITE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "plan" "MembershipPlan" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "membership_monthly_benefits" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_monthly_benefits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memberships_playerId_key" ON "memberships"("playerId");
CREATE UNIQUE INDEX "memberships_stripeCustomerId_key" ON "memberships"("stripeCustomerId");
CREATE UNIQUE INDEX "memberships_stripeSubscriptionId_key" ON "memberships"("stripeSubscriptionId");
CREATE INDEX "memberships_status_idx" ON "memberships"("status");
CREATE INDEX "memberships_plan_idx" ON "memberships"("plan");
CREATE UNIQUE INDEX "membership_monthly_benefits_code_key" ON "membership_monthly_benefits"("code");
CREATE UNIQUE INDEX "membership_monthly_benefits_membershipId_period_key" ON "membership_monthly_benefits"("membershipId", "period");
CREATE INDEX "membership_monthly_benefits_code_idx" ON "membership_monthly_benefits"("code");

ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "players"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_monthly_benefits"
ADD CONSTRAINT "membership_monthly_benefits_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "memberships"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
