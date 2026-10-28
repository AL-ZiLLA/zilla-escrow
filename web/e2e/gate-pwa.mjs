// Demo password gate + PWA installability checks.
// Usage: BASE=https://... GATE_ENV=/path/to/demo.env node e2e/gate-pwa.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { readGatePassword, unlock } from './gate-lib.mjs';
const req = createRequire(path.join(process.env.PW_DIR ?? '/workspace/pwshot', 'x.js'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = (process.env.BASE ?? 'http://127.0.0.1:3216').replace(/\/$/, '');
const OUT = process.env.OUT ?? path.resolve('../docs/screenshots/pwa');
fs.mkdirSync(OUT, { recursive: true });
const password = readGatePassword();
if (!password) { console.error('GATE_ENV with DEMO_PASSWORD is required'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' (threw)', false, e.message.split('\n')[0]); } };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' };

await step('locked routes redirect to /unlock', async () => {
  const ctx = await browser.newContext(mobile);
  for (const route of ['/', '/fund', '/recorded', '/activity']) {
    const res = await ctx.request.get(BASE + route, { maxRedirects: 0 });
    const loc = res.headers()['location'] ?? '';
    check(`GET ${route} unauthenticated -> /unlock`, [307, 308, 302].includes(res.status()) && new URL(loc, BASE).pathname === '/unlock', `${res.status()} ${loc}`);
  }
  for (const route of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/apple-icon.png', '/favicon.ico', '/unlock']) {
    const res = await ctx.request.get(BASE + route, { maxRedirects: 0 });
    check(`GET ${route} reachable without the gate`, res.status() === 200, res.status());
  }
  const sw = await ctx.request.get(BASE + '/sw.js');
  check('sw.js served as JavaScript, no-cache', /javascript/.test(sw.headers()['content-type'] ?? '') && /no-cache|no-store/.test(sw.headers()['cache-control'] ?? ''), `${sw.headers()['content-type']} | ${sw.headers()['cache-control']}`);
  const mf = await (await ctx.request.get(BASE + '/manifest.webmanifest')).json();
  check('manifest: standalone, start_url /, 192+512 any+maskable', mf.display === 'standalone' && mf.start_url === '/' &&
    ['192x192', '512x512'].every(s => mf.icons.some(i => i.sizes === s && i.purpose === 'any') && mf.icons.some(i => i.sizes === s && i.purpose === 'maskable')), JSON.stringify({ display: mf.display, start: mf.start_url, n: mf.icons.length }));
  await ctx.close();
});

await step('wrong password is rejected', async () => {
  const ctx = await browser.newContext(mobile); const page = await ctx.newPage();
  await page.goto(`${BASE}/unlock?next=%2Ffund`, { waitUntil: 'networkidle' });
  await page.fill('input[name=password]', 'definitely-not-it-0000');
  await Promise.all([page.waitForURL(/error=wrong/, { timeout: 30000 }), page.click('button[type=submit]')]);
  check('wrong password stays on /unlock with an error', new URL(page.url()).pathname === '/unlock' && await page.locator('#unlock-error').isVisible(), page.url());
  check('no gate cookie after a wrong password', !(await ctx.cookies()).some(c => c.name === 'zilla_demo_gate'));
  await page.screenshot({ path: path.join(OUT, 'unlock-error-390.png') });
  await ctx.close();
});

await step('right password unlocks, app installs', async () => {
  // Persistent (non-incognito) profile: Chrome never reports incognito windows as installable.
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/zilla-pwa-'), { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], ...mobile });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto(BASE + '/unlock', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, 'unlock-390.png') });
  await page.addScriptTag({ content: axeSrc });
  const ax = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => v.id));
  check('/unlock axe WCAG 2.1 AA at 390', ax.length === 0, ax.join(','));
  check('/unlock shows the testnet notice', await page.getByText('TESTNET · Arbitrum Sepolia').isVisible());

  await unlock(page, BASE, password, '/fund');
  check('right password lands on /fund', new URL(page.url()).pathname === '/fund', page.url());
  const cookie = (await ctx.cookies()).find(c => c.name === 'zilla_demo_gate');
  const days = cookie ? (cookie.expires - Date.now() / 1000) / 86400 : 0;
  check('gate cookie is httpOnly, secure, sameSite=Lax, ~30 days', cookie && cookie.httpOnly && cookie.secure && cookie.sameSite === 'Lax' && days > 29 && days <= 30.01, cookie ? `${cookie.httpOnly} ${cookie.secure} ${cookie.sameSite} ${days.toFixed(2)}d` : 'missing');
  check('gate cookie does not contain the password', cookie && !cookie.value.includes(password));
  await page.goto(BASE + '/recorded', { waitUntil: 'domcontentloaded' });
  check('unlocked browser reaches /recorded', new URL(page.url()).pathname === '/recorded');

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
    apple: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.getAttribute('content'),
    status: document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.getAttribute('content'),
    touch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
    theme: [...document.querySelectorAll('meta[name=theme-color]')].map(m => m.getAttribute('content')),
  }));
  check('head: manifest link, iOS meta, apple-touch-icon, theme colors', head.manifest && head.apple === 'yes' && head.status && head.touch && head.theme.includes('#0a0a0a') && head.theme.includes('#f5f3ee'), JSON.stringify(head));
  const sw = await page.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(res => setTimeout(() => res(null), 15000))]); return r ? r.active?.scriptURL ?? 'pending' : null; });
  check('service worker active', sw && sw.endsWith('/sw.js'), sw);
  const cdp = await ctx.newCDPSession(page);
  await page.reload({ waitUntil: 'networkidle' });
  const man = await cdp.send('Page.getAppManifest');
  check('Chrome manifest parse: no errors', (man.errors ?? []).length === 0, JSON.stringify(man.errors));
  const inst = await cdp.send('Page.getInstallabilityErrors');
  check('Chrome installability at 390: no errors (installable)', (inst.installabilityErrors ?? []).length === 0, JSON.stringify(inst.installabilityErrors));
  await page.screenshot({ path: path.join(OUT, 'installed-landing-390.png') });

  // Offline launch from the service worker cache, and RPC never cached.
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  check('offline launch renders the app shell', (await page.locator('.esc-brand').count()) > 0, page.url());
  await ctx.setOffline(false);
  const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out; });
  check('cache holds only same-origin shell/static entries', cached.length > 0 && cached.every(u => new URL(u).origin === new URL(BASE).origin && !/\/api\/|_rsc=/.test(u)), `${cached.length} entries`);
  await ctx.close();
});

await browser.close();
const failed = results.filter(r => !r.ok).length;
fs.writeFileSync(path.join(OUT, 'gate-pwa-results.json'), JSON.stringify({ base: BASE, total: results.length, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
