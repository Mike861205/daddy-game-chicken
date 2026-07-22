-- Preserve the exact prize text earned, even if promotions change later.
ALTER TABLE "rewards"
ADD COLUMN "label" TEXT NOT NULL DEFAULT 'PROMOCIÓN DADDY POLLO';
