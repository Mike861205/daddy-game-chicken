-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "playerId" UUID,
    "nickname" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "selectedBranch" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "caughtItems" INTEGER NOT NULL DEFAULT 0,
    "missedItems" INTEGER NOT NULL DEFAULT 0,
    "livesRemaining" INTEGER NOT NULL DEFAULT 0,
    "clientSessionId" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "discountPercentage" INTEGER,
    "status" "RewardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_configurations" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_nickname_idx" ON "players"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_clientSessionId_key" ON "game_sessions"("clientSessionId");

-- CreateIndex
CREATE INDEX "game_sessions_score_idx" ON "game_sessions"("score");

-- CreateIndex
CREATE INDEX "game_sessions_createdAt_idx" ON "game_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "game_sessions_playerId_idx" ON "game_sessions"("playerId");

-- CreateIndex
CREATE INDEX "game_sessions_clientSessionId_idx" ON "game_sessions"("clientSessionId");

-- CreateIndex
CREATE INDEX "game_sessions_selectedBranch_idx" ON "game_sessions"("selectedBranch");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_code_key" ON "rewards"("code");

-- CreateIndex
CREATE INDEX "rewards_code_idx" ON "rewards"("code");

-- CreateIndex
CREATE INDEX "rewards_status_idx" ON "rewards"("status");

-- CreateIndex
CREATE INDEX "rewards_gameSessionId_idx" ON "rewards"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "game_configurations_key_key" ON "game_configurations"("key");

-- CreateIndex
CREATE INDEX "game_configurations_key_idx" ON "game_configurations"("key");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
