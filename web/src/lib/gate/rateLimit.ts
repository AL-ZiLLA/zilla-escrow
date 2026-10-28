import { createHmac } from 'node:crypto';
import { safeEqual } from './token';

/**
 * Best-effort brute-force throttle for /api/unlock. There is no shared durable store on
 * this Vercel project, so two layers are combined, and neither alone is a hard guarantee:
 *  1. An in-memory counter per client IP (x-real-ip, set by Vercel). It lives only in one
 *     warm function instance, so attempts spread across instances are counted separately.
 *  2. A signed attempt cookie (HMAC with DEMO_GATE_SECRET). A browser cannot reset or forge
 *     it, but a script can simply drop it.
 * After MAX_FAILS failures inside WINDOW_MS the client is locked out for LOCK_MS, doubling on
 * each repeat lockout (capped at MAX_LOCK_MS). While locked, the password is not checked at
 * all. Every failure also waits a growing delay before answering. The real defence is a long
 * random password; a firewall rate-limit rule or a KV counter would make this a hard limit.
 */
export const TRIES_COOKIE = 'zilla_gate_tries';
export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const MAX_LOCK_MS = 4 * 60 * 60 * 1000;
export const TRIES_MAX_AGE = 24 * 60 * 60; // seconds

export type Tries = { count: number; start: number; lockedUntil: number; lockouts: number };
export const EMPTY: Tries = { count: 0, start: 0, lockedUntil: 0, lockouts: 0 };

export function lockedFor(t: Tries, now = Date.now()): number {
  return t.lockedUntil > now ? t.lockedUntil - now : 0;
}

export function afterFail(t: Tries, now = Date.now()): Tries {
  const fresh = t.count === 0 || now - t.start > WINDOW_MS;
  const next = { ...t, count: fresh ? 1 : t.count + 1, start: fresh ? now : t.start };
  if (next.count >= MAX_FAILS) {
    const lockouts = t.lockouts + 1;
    return { count: 0, start: 0, lockouts, lockedUntil: now + Math.min(LOCK_MS * 2 ** (lockouts - 1), MAX_LOCK_MS) };
  }
  return next;
}

/** Delay before answering a failed attempt: 500 ms, 1 s, 2 s, 4 s, capped at 4 s. */
export function failDelayMs(t: Tries): number {
  return Math.min(500 * 2 ** Math.max(t.count - 1, 0), 4000);
}

/** The stricter of two records wins, so dropping the cookie never loosens the memory layer. */
export function stricter(a: Tries, b: Tries): Tries {
  if (a.lockedUntil !== b.lockedUntil) return a.lockedUntil > b.lockedUntil ? a : b;
  if (a.lockouts !== b.lockouts) return a.lockouts > b.lockouts ? a : b;
  return a.count >= b.count ? a : b;
}

const mac = (secret: string, body: string) => createHmac('sha256', secret).update(`tries|v1|${body}`).digest('base64url');

export function encodeTries(secret: string, t: Tries): string {
  const body = `${t.count}.${t.start}.${t.lockedUntil}.${t.lockouts}`;
  return `${body}.${mac(secret, body)}`;
}

export function decodeTries(secret: string, value: string | undefined): Tries {
  if (!value) return EMPTY;
  const parts = value.split('.');
  if (parts.length !== 5) return EMPTY;
  const body = parts.slice(0, 4).join('.');
  if (!safeEqual(parts[4], mac(secret, body))) return EMPTY;
  const [count, start, lockedUntil, lockouts] = parts.slice(0, 4).map(Number);
  if (![count, start, lockedUntil, lockouts].every((n) => Number.isSafeInteger(n) && n >= 0)) return EMPTY;
  return { count, start, lockedUntil, lockouts };
}

// Per-instance memory layer, keyed by client IP.
const memory = new Map<string, Tries>();
export function memoryGet(key: string): Tries { return memory.get(key) ?? EMPTY; }
export function memorySet(key: string, t: Tries): void {
  if (memory.size > 5000) memory.clear();
  memory.set(key, t);
}
export function memoryClear(key: string): void { memory.delete(key); }
