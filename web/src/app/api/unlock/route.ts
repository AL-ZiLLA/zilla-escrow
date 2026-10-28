import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, GATE_MAX_AGE, checkPassword, gateMode, issueToken, safeNext } from '@/lib/gate/token';
import {
  TRIES_COOKIE, TRIES_MAX_AGE, afterFail, decodeTries, encodeTries, failDelayMs, lockedFor,
  memoryClear, memoryGet, memorySet, stricter, type Tries,
} from '@/lib/gate/rateLimit';

// Redirect on the host the browser used (request.url can carry the bind host instead).
function at(request: NextRequest, path: string) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return new URL(path, host ? `${proto}://${host}` : request.url);
}

function back(request: NextRequest, error: string, next: string, waitMs = 0) {
  const url = at(request, '/unlock');
  url.searchParams.set('error', error);
  if (waitMs > 0) url.searchParams.set('wait', String(Math.max(1, Math.ceil(waitMs / 60000))));
  if (next !== '/') url.searchParams.set('next', next);
  const res = NextResponse.redirect(url, 303);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function setTries(res: NextResponse, secret: string, t: Tries) {
  res.cookies.set(TRIES_COOKIE, encodeTries(secret, t), {
    httpOnly: true, secure: true, sameSite: 'strict', path: '/api/unlock', maxAge: TRIES_MAX_AGE,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeNext(String(form?.get('next') ?? '/'));
  const gate = gateMode();
  if (gate.mode === 'off') return NextResponse.redirect(at(request, next), 303);
  if (gate.mode === 'misconfigured') return back(request, 'config', next);

  const client = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const { secret } = gate.config;
  const now = Date.now();
  const tries = stricter(memoryGet(client), decodeTries(secret, request.cookies.get(TRIES_COOKIE)?.value));

  // Locked out: answer without checking the password, so a lockout gives no oracle.
  const wait = lockedFor(tries, now);
  if (wait > 0) {
    await sleep(500);
    const res = back(request, 'limit', next, wait);
    setTries(res, secret, tries);
    return res;
  }

  const attempt = String(form?.get('password') ?? '');
  if (!checkPassword(gate.config, attempt)) {
    const updated = afterFail(tries, now);
    memorySet(client, updated);
    const lock = lockedFor(updated, now);
    await sleep(lock > 0 ? 4000 : failDelayMs(updated));
    const res = back(request, lock > 0 ? 'limit' : 'wrong', next, lock);
    setTries(res, secret, updated);
    return res;
  }
  memoryClear(client);
  const res = NextResponse.redirect(at(request, next), 303);
  res.cookies.set(GATE_COOKIE, issueToken(gate.config), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_MAX_AGE,
  });
  res.cookies.set(TRIES_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/unlock', maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
