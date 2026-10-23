// Simple admin auth — HTTP-only cookie containing a signed session token.
// We use a HMAC-SHA256 of "admin|<expiresAt>" with the ADMIN_PASSWORD as secret.
// On every request the API routes verify the cookie via verifySession().

import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "pz_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const p = process.env.ADMIN_PASSWORD;
  if (!p) throw new Error("Falta variable de entorno ADMIN_PASSWORD");
  return p;
}

export function signSession(expiresAt: number): string {
  const secret = getSecret();
  const payload = `admin|${expiresAt}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${expiresAt}.${mac}`;
}

export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;
  const expected = signSession(expiresAt);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyPassword(password: string): boolean {
  try {
    const secret = getSecret();
    const a = Buffer.from(password);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function makeSessionCookie(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = signSession(expiresAt);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

export function makeLogoutCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure`;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

export function readSessionFromRequest(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}
