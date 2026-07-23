import type { Request, Response } from 'express';
import { getAdminPlayerReport } from '../services/adminReport.service.js';
import { adminPlayerReportQuerySchema } from '../validators/adminReport.validator.js';

/** GET /api/admin/reports/players - owner-only game success report. */
export async function getAdminPlayerReportHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = adminPlayerReportQuerySchema.parse(req.query);
  const report = await getAdminPlayerReport(query);
  res.status(200).json({ data: report });
}
