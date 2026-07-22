import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js';
import { localDeployOnly } from '../middleware/localDeployOnly.js';
import {
  getAdminConfiguration,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  updateAdminConfiguration,
} from '../controllers/admin.controller.js';
import {
  getDeploymentStatusHandler,
  startDeploymentHandler,
} from '../controllers/deployment.controller.js';

const router = Router();

router.post('/login', adminLoginRateLimiter, asyncHandler(loginAdmin));
router.post('/logout', asyncHandler(logoutAdmin));
router.get('/session', asyncHandler(getAdminSession));
router.get('/configuration', requireAdmin, asyncHandler(getAdminConfiguration));
router.put('/configuration', requireAdmin, asyncHandler(updateAdminConfiguration));
router.get('/deployment', requireAdmin, asyncHandler(getDeploymentStatusHandler));
router.post(
  '/deployment',
  requireAdmin,
  localDeployOnly,
  asyncHandler(startDeploymentHandler),
);

export default router;
