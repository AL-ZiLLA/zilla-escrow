// Rate-limit-lite: per-instance memory, 8 failed attempts per client per 10 minutes.
// Serverless instances do not share it; it slows guessing, it is not a lockout.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map<string, { count: number; start: number }>();

export function isLimited(key: string, now = Date.now()): boolean {
  const entry = fails.get(key);
  if (!entry) return false;
  if (now - entry.start > WINDOW_MS) { fails.delete(key); return false; }
  return entry.count >= MAX_FAILS;
}

export function recordFail(key: string, now = Date.now()): void {
  const entry = fails.get(key);
  if (!entry || now - entry.start > WINDOW_MS) fails.set(key, { count: 1, start: now });
  else entry.count += 1;
  if (fails.size > 5000) fails.clear();
}

export function clearFails(key: string): void { fails.delete(key); }
