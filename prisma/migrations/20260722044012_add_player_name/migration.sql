-- AlterTable
ALTER TABLE "players" ADD COLUMN     "name" TEXT;

-- CreateIndex
CREATE INDEX "players_phone_idx" ON "players"("phone");
