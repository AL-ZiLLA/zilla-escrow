import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, gateMode, safeNext, verifyToken } from '@/lib/gate/token';

// Demo password gate. Every route except the unlock flow and the install assets
// (manifest, icons, service worker, logo, Next static files) needs a valid cookie.
export function proxy(request: NextRequest) {
  const gate = gateMode();
  if (gate.mode === 'off') return NextResponse.next();
  if (gate.mode === 'on' && verifyToken(gate.config, request.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.search = '';
  const next = safeNext(pathname + search);
  if (next !== '/') url.searchParams.set('next', next);
  const res = NextResponse.redirect(url, 307);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  matcher: [
    '/((?!unlock|api/unlock|manifest\\.webmanifest|sw\\.js|icons/|icon\\.svg|apple-icon\\.png|favicon\\.ico|zilla-logo-official\\.svg|_next/static|_next/image).*)',
  ],
};
