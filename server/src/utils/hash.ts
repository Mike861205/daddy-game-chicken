import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Produce a non-reversible hash of an IP address.
 * We never persist the raw IP, only a salted hash used for basic abuse control.
 */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }
  return createHash('sha256')
    .update(`${env.rewardSecret}:${ip}`)
    .digest('hex');
}
