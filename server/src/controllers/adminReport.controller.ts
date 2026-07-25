import type { Request, Response } from 'express';
import { getAdminPlayerReport } from '../services/adminReport.service.js';
import { getAdminMembershipReport } from '../services/membershipReport.service.js';
import {
  adminMembershipReportQuerySchema,
  adminPlayerReportQuerySchema,
} from '../validators/adminReport.validator.js';

/** GET /api/admin/reports/players - owner-only game success report. */
export async function getAdminPlayerReportHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = adminPlayerReportQuerySchema.parse(req.query);
  const report = await getAdminPlayerReport(query);
  res.status(200).json({ data: report });
}

/** GET /api/admin/reports/memberships - owner-only membership roster. */
export async function getAdminMembershipReportHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = adminMembershipReportQuerySchema.parse(req.query);
  const report = await getAdminMembershipReport(query);
  res.status(200).json({ data: report });
}
