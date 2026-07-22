#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Daddy Game Chicken - safe production deploy script.
# Pulls latest code, installs deps, runs migrations (non-destructive),
# builds frontend + backend, and restarts the API with PM2.
#
# This script NEVER runs destructive database commands
# (no migrate reset, no DROP, no .env overwrite).
# ---------------------------------------------------------------------------
set -euo pipefail

# 1. Move to the project directory.
PROJECT_DIR="${PROJECT_DIR:-/var/www/daddy-game-chicken}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
cd "$PROJECT_DIR"

echo "==> Deploying Daddy Game Chicken from $PROJECT_DIR"

# Safety: refuse to run if .env is missing.
if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Create it before deploying." >&2
  exit 1
fi

# 2. Pull the latest production code.
echo "==> Pulling latest code ($DEPLOY_BRANCH)"
git pull --ff-only origin "$DEPLOY_BRANCH"

# 3. Install dependencies from the lockfile.
echo "==> Installing dependencies (npm ci)"
npm ci

# 4. Generate the Prisma client.
echo "==> Generating Prisma client"
npm run prisma:generate

# 5. Apply production migrations (non-destructive).
echo "==> Applying database migrations (deploy)"
npm run prisma:migrate:deploy

# 6. Build backend and frontend.
echo "==> Building server and game"
npm run build

# 7. Restart (or start) the API with PM2.
echo "==> Restarting API with PM2"
if pm2 describe daddy-game-chicken-api > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only daddy-game-chicken-api
else
  pm2 start ecosystem.config.cjs --only daddy-game-chicken-api
fi
pm2 save

# 8. Show final status.
echo "==> Deploy complete. Current PM2 status:"
pm2 status
