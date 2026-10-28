// Live checks for the unlock endpoint: open-redirect cases and the brute-force lockout.
// Run gate-pwa.mjs FIRST: this script locks the calling IP out of /api/unlock for 15+ minutes.
// The password is read in-process from GATE_ENV and never logged or written.
import fs from 'node:fs';
import path from 'node:path';
import { readGatePassword } from './gate-lib.mjs';

const BASE = (process.env.BASE ?? 'http://127.0.0.1:3216').replace(/\/$/, '');
const OUT = process.env.OUT ?? '../docs/screenshots/pwa';
const password = readGatePassword();
if (!password) throw new Error('GATE_ENV with DEMO_PASSWORD is required');
const origin = new URL(BASE).origin;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`); };

function cookiesOf(res) { return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]); }
async function post(pw, next, cookie) {
  const body = new URLSearchParams({ password: pw, next });
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/unlock`, { method: 'POST', body, redirect: 'manual', headers: cookie ? { cookie } : {} });
  const loc = res.headers.get('location') ?? '';
  const url = loc ? new URL(loc, BASE) : null;
  return { status: res.status, url, ms: Date.now() - t0, set: cookiesOf(res), error: url?.searchParams.get('error') ?? null, wait: url?.searchParams.get('wait') ?? null };
}

// 1. Open redirect: correct password, hostile next values. Location must stay on this origin.
const hostile = ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/ /evil.example', '//evil.example', '///evil.example',
  '/\\evil.example', '\\\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/..//evil.example', '/%09/evil.example'];
for (const next of hostile) {
  const r = await post(password, next);
  check(`redirect stays on origin for next=${JSON.stringify(next)}`, r.status === 303 && r.url?.origin === origin && !r.url.pathname.startsWith('//'), `${r.status} ${r.url?.origin}${r.url?.pathname}`);
}
const good = await post(password, '/fund?x=1');
check('a normal next still works after unlock', good.status === 303 && good.url?.origin === origin && good.url.pathname === '/fund' && good.set.some((c) => c.startsWith('zilla_demo_gate=')), `${good.url?.pathname}${good.url?.search}`);

// 2. Browser-style: keep the attempt cookie across 6 wrong tries, then try the right password.
let jar = '';
const browser = [];
for (let i = 1; i <= 6; i++) {
  const r = await post(`wrong-guess-${i}`, '/', jar);
  const t = r.set.find((c) => c.startsWith('zilla_gate_tries='));
  if (t) jar = t;
  browser.push({ attempt: i, error: r.error, wait: r.wait, ms: r.ms });
}
console.log('browser-style', JSON.stringify(browser));
const firstLimit = browser.findIndex((b) => b.error === 'limit') + 1;
check('wrong attempts with the cookie are locked out by attempt 5', firstLimit > 0 && firstLimit <= 5, `first limit at attempt ${firstLimit}`);
check('every attempt after the lockout is refused', browser.slice(firstLimit - 1).every((b) => b.error === 'limit'));
const locked = await post(password, '/', jar);
check('the RIGHT password is refused while locked out, and no gate cookie is set', locked.error === 'limit' && !locked.set.some((c) => c.startsWith('zilla_demo_gate=')), `error=${locked.error} wait=${locked.wait}`);

// 3. Script-style: no cookies at all (memory layer only, per warm instance). Reported as observed.
const script = [];
for (let i = 1; i <= 6; i++) { const r = await post(`script-guess-${i}`, '/'); script.push({ attempt: i, error: r.error, ms: r.ms }); }
console.log('script-style (no cookie)', JSON.stringify(script));
const scriptBlocked = script.filter((s) => s.error === 'limit').length;
check('cookie-less sequential attempts are also blocked (memory layer, best-effort)', scriptBlocked > 0, `${scriptBlocked}/6 refused as limit`);

// 4. Parallel burst without cookies: shows the honest limit of a per-instance memory store.
const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => post(`burst-guess-${i}`, '/')));
const burstSummary = { limit: burst.filter((b) => b.error === 'limit').length, wrong: burst.filter((b) => b.error === 'wrong').length, other: burst.filter((b) => !['limit', 'wrong'].includes(b.error)).length };
console.log('parallel burst (no cookie)', JSON.stringify(burstSummary));
check('no attempt in the burst unlocked', burst.every((b) => !b.set.some((c) => c.startsWith('zilla_demo_gate='))));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'gate-attack.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), browser, script, burst: burstSummary, results }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
