import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';
import { getHealth } from '../controllers/health.controller.js';
import { getPublicConfiguration } from '../controllers/config.controller.js';
import {
  getLeaderboardHandler,
  submitGameSession,
} from '../controllers/gameSession.controller.js';
import { createReward, validateReward } from '../controllers/reward.controller.js';
import { lookupPlayer } from '../controllers/player.controller.js';
import {
  createMembershipCheckoutHandler,
  claimMembershipBenefitHandler,
  confirmMembershipCheckoutHandler,
  getMembershipStatusHandler,
} from '../controllers/membership.controller.js';

const router = Router();

// Health
router.get('/health', asyncHandler(getHealth));

// Public configuration
router.get('/config/public', asyncHandler(getPublicConfiguration));

// Players
router.get('/players/lookup', asyncHandler(lookupPlayer));

// Memberships
router.get('/memberships/status', asyncHandler(getMembershipStatusHandler));
router.post(
  '/memberships/checkout',
  writeRateLimiter,
  asyncHandler(createMembershipCheckoutHandler),
);
router.post(
  '/memberships/confirm',
  writeRateLimiter,
  asyncHandler(confirmMembershipCheckoutHandler),
);
router.post(
  '/memberships/benefits/claim',
  writeRateLimiter,
  asyncHandler(claimMembershipBenefitHandler),
);

// Game sessions
router.post('/game-sessions', writeRateLimiter, asyncHandler(submitGameSession));

// Leaderboard
router.get('/leaderboard', asyncHandler(getLeaderboardHandler));

// Rewards
router.post('/rewards', writeRateLimiter, asyncHandler(createReward));
router.post('/rewards/validate', asyncHandler(validateReward));

export default router;
