import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const COOKIE_NAME = 'dgc_admin_session';
const SESSION_HOURS = 8;

function sign(value: string): string {
  return createHmac('sha256', env.adminSessionSecret).update(value).digest('base64url');
}

function readCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const entry = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return entry ? decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)) : null;
}

function isValidToken(token: string | null): boolean {
  if (!token) {
    return false;
  }
  const [expiresRaw, signature] = token.split('.');
  const expiresAt = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }
  const expected = sign(expiresRaw);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function securelyMatches(value: string, expected: string): boolean {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function adminCredentialsMatch(username: string, password: string): boolean {
  return securelyMatches(username, env.adminUsername) && securelyMatches(password, env.adminPassword);
}

export function startAdminSession(res: Response): void {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const value = `${expiresAt}.${sign(String(expiresAt))}`;
  res.cookie(COOKIE_NAME, value, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

export function endAdminSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

export function hasAdminSession(req: Request): boolean {
  return isValidToken(readCookie(req));
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!hasAdminSession(req)) {
    next(AppError.unauthorized('Inicia sesión para administrar el juego.'));
    return;
  }
  next();
}
