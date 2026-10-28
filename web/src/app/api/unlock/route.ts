import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, GATE_MAX_AGE, checkPassword, gateMode, issueToken, safeNext } from '@/lib/gate/token';
import { clearFails, isLimited, recordFail } from '@/lib/gate/rateLimit';

// Redirect on the host the browser used (request.url can carry the bind host instead).
function at(request: NextRequest, path: string) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return new URL(path, host ? `${proto}://${host}` : request.url);
}

function back(request: NextRequest, error: string, next: string) {
  const url = at(request, '/unlock');
  url.searchParams.set('error', error);
  if (next !== '/') url.searchParams.set('next', next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeNext(String(form?.get('next') ?? '/'));
  const gate = gateMode();
  if (gate.mode === 'off') return NextResponse.redirect(at(request, next), 303);
  if (gate.mode === 'misconfigured') return back(request, 'config', next);

  const client = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (isLimited(client)) return back(request, 'limit', next);

  const attempt = String(form?.get('password') ?? '');
  if (!checkPassword(gate.config, attempt)) {
    recordFail(client);
    await new Promise((r) => setTimeout(r, 400));
    return back(request, 'wrong', next);
  }
  clearFails(client);
  const res = NextResponse.redirect(at(request, next), 303);
  res.cookies.set(GATE_COOKIE, issueToken(gate.config), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
