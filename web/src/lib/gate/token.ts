import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const GATE_COOKIE = 'zilla_demo_gate';
export const GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export type GateConfig = { password: string; secret: string };
export type GateMode = { mode: 'off' } | { mode: 'on'; config: GateConfig } | { mode: 'misconfigured' };

/**
 * Off only when DEMO_PASSWORD is unset outside Vercel (local dev and local e2e).
 * On Vercel a missing password or secret fails closed: every route stays behind /unlock.
 */
export function gateMode(env: Record<string, string | undefined> = process.env): GateMode {
  const password = env.DEMO_PASSWORD ?? '';
  const secret = env.DEMO_GATE_SECRET ?? '';
  if (!password) return env.VERCEL ? { mode: 'misconfigured' } : { mode: 'off' };
  if (secret.length < 32) return { mode: 'misconfigured' };
  return { mode: 'on', config: { password, secret } };
}

const sha256 = (v: string) => createHash('sha256').update(v).digest();

function sign(config: GateConfig, exp: number): string {
  // Binding the password digest means rotating DEMO_PASSWORD invalidates every cookie.
  return createHmac('sha256', config.secret).update(`v1|${exp}|`).update(sha256(config.password)).digest('base64url');
}

/** Constant-time string compare: hashes both sides so lengths never leak. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

export function checkPassword(config: GateConfig, attempt: string): boolean {
  return safeEqual(attempt, config.password);
}

export function issueToken(config: GateConfig, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + GATE_MAX_AGE;
  return `${exp}.${sign(config, exp)}`;
}

export function verifyToken(config: GateConfig, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isSafeInteger(exp) || exp * 1000 <= now) return false;
  return safeEqual(token.slice(dot + 1), sign(config, exp));
}

/** Only same-site relative paths survive, so ?next= can never redirect off the app. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/unlock')) return '/';
  return next;
}
