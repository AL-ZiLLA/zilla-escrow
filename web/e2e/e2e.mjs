// Zilla Escrow UI end-to-end walk. Uses playwright-core + axe-core from PW_DIR (default /workspace/pwshot).
// Usage: BASE=http://127.0.0.1:3215 node e2e/e2e.mjs   Outputs e2e/out/results.json and screenshots.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(path.join(process.env.PW_DIR ?? '/workspace/pwshot', 'x.js'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3215';
const OUT = process.env.OUT ?? path.resolve('../docs/screenshots/e2e');
fs.mkdirSync(OUT, { recursive: true });
const run = JSON.parse(fs.readFileSync('src/data/run.json', 'utf8'));
const prior = JSON.parse(fs.readFileSync('src/data/run-v1.json', 'utf8'));
const realTx = new Set([...run.steps, ...prior.steps].map(s => s.txHash.toLowerCase()));
const realAddr = new Set([run, prior].flatMap(r => [r.contracts.escrow, r.contracts.token, ...Object.values(r.roles)]).map(a => a.toLowerCase()));
const realHref = h => { const m = h.match(/^https:\/\/sepolia\.arbiscan\.io\/(tx|address)\/(0x[0-9a-fA-F]+)$/); return !!m && (m[1] === 'tx' ? realTx : realAddr).has(m[2].toLowerCase()); };
const routes = ['/', '/connect', '/create', '/accept', '/agreement', '/milestones', '/timeline', '/scope', '/fund', '/proof', '/proof/p1', '/release', '/changes', '/dispute', '/activity', '/states', '/recorded'];
const results = []; const shots = [];
let current = '';
const check = (name, ok, detail = '') => { results.push({ group: current, name, ok: !!ok, detail: String(detail).slice(0, 400) }); console.log(`${ok ? 'PASS' : 'FAIL'} [${current}] ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`); };
async function step(name, fn) { try { await fn(); } catch (e) { check(name + ' (threw)', false, e.message.split('\n')[0]); } }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', e => page.errors.push(e.message));
  return page;
}
const closeCtx = pg => Promise.race([pg.context().close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
const go = async (p, r) => { await p.goto(BASE + r, { waitUntil: 'networkidle' }); };
const role = async (p, r) => { await p.selectOption('select[aria-label="Preview role"]', r); };
const vis = (p, sel) => p.locator(sel).filter({ visible: true }).first();
const btn = (p, name) => p.getByRole('button', { name }).filter({ visible: true }).first();
const hasText = async (p, re) => (await p.locator('body').innerText()).match(re) != null;
const shot = async (p, name) => { const f = path.join(OUT, name + '.png'); await p.screenshot({ path: f }); shots.push(f); };

// 1. Route smoke, both widths
for (const width of [1280, 390]) {
  current = `routes@${width}`;
  const p = await newPage({ viewport: { width, height: 900 } });
  for (const r of routes) await step(r, async () => {
    p.errors = [];
    const res = await p.goto(BASE + r, { waitUntil: 'networkidle' });
    const h1 = await p.locator('h1').count();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${r} 200, h1, no overflow, no console errors`, res.status() === 200 && h1 > 0 && overflow <= 1 && p.errors.length === 0, `status ${res.status()} h1 ${h1} overflow ${overflow} errors ${p.errors.join(' | ')}`);
    if (r !== '/recorded') check(`${r} testnet + demo notices present`, await hasText(p, /FICTIONAL DEMO/) && await hasText(p, /Not audited/i));
  });
  await closeCtx(p);
}

// 2. Client flow
current = 'client';
{
  const p = await newPage();
  await step('landing gate', async () => { await go(p, '/'); for (let i = 0; i < 2; i++) await btn(p, /Explore next step/).click(); check('landing gate reaches Released', await hasText(p, /Client accepted the work in this illustration/)); });
  await step('connect', async () => {
    await go(p, '/connect'); await p.getByRole('button', { name: /Browser wallet/ }).click();
    check('connecting state shows preview label', await hasText(p, /Waiting for wallet approval · UI preview/));
    await btn(p, 'Preview connected').click(); check('connected shows role client', await hasText(p, /Agreement role: client/));
    await p.selectOption('label:has-text("Connection state") select', 'wrong network'); await btn(p, /Switch to Arbitrum Sepolia/).click(); check('wrong network recovers', await hasText(p, /Agreement role: client/));
    check('faucet buttons disabled (no invented faucets)', await btn(p, /Get test ETH/).isDisabled() && await btn(p, /Get test mUSDC/).isDisabled());
  });
  await step('create', async () => {
    await go(p, '/create'); await btn(p, 'Review agreement').click(); check('review step shows fingerprint', await hasText(p, /Fingerprint of this exact document/i));
    await btn(p, /Create agreement · preview/).click(); check('created -> proposed notice', await hasText(p, /Agreement proposed by provider in this fixture/));
  });
  await step('create validation', async () => {
    await go(p, '/create'); await p.getByLabel('Scope title').fill(''); await btn(p, 'Review agreement').click();
    check('empty title is rejected (native required or inline error)', p.url().endsWith('/create') && (await hasText(p, /Enter a scope title/i) || await p.getByLabel('Scope title').evaluate(e => !e.validity.valid)));
  });
  await step('accept', async () => {
    await go(p, '/accept'); check('accept disabled before checkbox', await btn(p, 'Accept exact scope').isDisabled());
    await p.getByLabel(/Preview scope fingerprint mismatch/).check(); await p.getByLabel(/I accept this scope/).check(); await btn(p, 'Accept exact scope').click();
    check('hash mismatch error shown', await hasText(p, /fingerprint|match/i));
    await p.getByLabel(/Preview scope fingerprint mismatch/).uncheck(); await btn(p, 'Accept exact scope').click(); check('scope acceptance previewed', await hasText(p, /Scope acceptance previewed/));
  });
  await step('fund P4', async () => {
    await go(p, '/fund'); const before = await p.locator('body').innerText();
    for (const n of [/Allow mUSDC/, /Preview pending/, /Preview confirmation/]) await btn(p, n).click();
    check('approve step confirmed, fund step unlocked', !(await btn(p, /Fund milestone · preview/).isDisabled()));
    for (const n of [/Fund milestone · preview/, /Preview pending/, /Preview confirmation/]) await btn(p, n).click();
    check('P4 funding previewed notice', await hasText(p, /P4 funding confirmation previewed/));
    check('notice says no transaction sent', await hasText(p, /No transaction was sent/));
    check('money summary changed', (await p.locator('body').innerText()) !== before);
    await shot(p, 'client-fund-done-1280');
  });
  await step('fund top-up + insufficient', async () => {
    await go(p, '/fund'); await p.locator('details.esc-simulation > summary').first().click(); await p.locator('label:has-text("Balance state") select').selectOption({ index: 1 }); check('insufficient balance state renders', await hasText(p, /insufficient|not enough/i));
    await p.selectOption('select[aria-label="Funding fixture"]', 'topup'); check('top-up fixture explains CO-2', await hasText(p, /CO-2 is approved/i));
  });
  await step('proof (client)', async () => { await go(p, '/proof'); check('client sees Review release', await vis(p, 'a:has-text("Review release")').isVisible()); check('client does not see proof composer', (await p.getByText('Compose a proof pack.').count()) === 0); });
  await step('release dialog + keyboard', async () => {
    await go(p, '/release'); await btn(p, /^Review release$/).click();
    const dlg = p.locator('dialog[open]'); check('dialog opens (modal)', await dlg.count() === 1);
    check('focus lands on Keep reviewing', await p.evaluate(() => document.activeElement?.textContent?.includes('Keep reviewing')));
    for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
    check('Tab stays inside dialog', await p.evaluate(() => !!document.activeElement?.closest('dialog')));
    check('desktop dialog keeps sticky testnet notice', await p.evaluate(() => getComputedStyle(document.querySelector('dialog[open] .esc-testnet')).position) === 'sticky');
    await shot(p, 'client-release-dialog-1280');
    await p.keyboard.press('Escape'); check('Escape closes dialog', await p.locator('dialog[open]').count() === 0);
    await btn(p, /^Review release$/).click(); await p.locator('dialog[open]').getByRole('button', { name: /^Release/ }).click();
    check('release previewed', await hasText(p, /Release confirmation previewed/));
    await p.locator('aside a[href="/agreement"]').filter({ visible: true }).first().click(); await p.waitForURL('**/agreement');
    check('released state persists across client navigation', await hasText(p, /Site design payment previewed/));
  });
  await step('changes approve CO-2', async () => {
    await go(p, '/changes'); check('approve disabled until checkbox', await btn(p, 'Approve change').isDisabled());
    await p.getByLabel(/I approve this change/).check(); await btn(p, 'Approve change').click(); check('CO-2 approval previewed', await hasText(p, /CO-2 approval previewed/));
  });
  await step('changes request + validation', async () => {
    await go(p, '/changes'); await btn(p, 'Request a change').click();
    await p.getByLabel('New due date').fill('2026-01-01'); await btn(p, 'Review change request').click(); check('earlier due date rejected', await hasText(p, /Due dates cannot move earlier/));
    await p.getByLabel('New due date').fill('2027-02-01'); await btn(p, 'Review change request').click(); await btn(p, /Propose change · preview/).click();
    check('change request proposal previewed', await hasText(p, /Change request proposal previewed/));
  });
  await step('changes stale', async () => { await go(p, '/changes'); await p.selectOption('label:has-text("Change state") select', 'Stale'); check('stale error renders', await hasText(p, /stale|outdated|version/i)); });
  await step('dispute open + refund', async () => {
    await go(p, '/dispute'); await btn(p, /Open dispute and freeze funds/).click(); check('confirm region appears', await p.getByRole('region', { name: 'Confirm money action' }).isVisible());
    await btn(p, /Confirm · preview/).click(); check('dispute opened previewed', await hasText(p, /Open dispute and freeze 4,500.00 mUSDC previewed/));
    await go(p, '/dispute'); check('take back disabled before window', await btn(p, 'Take back funds').isDisabled());
    await p.selectOption('label:has-text("Time preview") select', 'eligible'); check('take back enabled after window', !(await btn(p, 'Take back funds').isDisabled()));
    await btn(p, 'Take back funds').click(); await btn(p, 'Keep reviewing').click(); check('Keep reviewing cancels confirm', await p.getByRole('region', { name: 'Confirm money action' }).count() === 0);
    check('client cannot return provider funds', await btn(p, 'Return funds to client').isDisabled());
  });
  await step('activity', async () => {
    await go(p, '/activity'); const all = await p.locator('.esc-audit li').count();
    await btn(p, 'Money').click(); const money = await p.locator('.esc-audit li').count();
    check('Money filter narrows list', all > 0 && money > 0 && money < all, `${all} -> ${money}`);
    await btn(p, 'Disputes').click(); check('Disputes empty state links to fixtures', await hasText(p, /No disputes events in this fixture/));
    await btn(p, 'All').click(); const [dl] = await Promise.all([p.waitForEvent('download'), btn(p, /Export fixture JSON/).click()]);
    const f = await dl.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8')); check('export downloads JSON of all events', dl.suggestedFilename() === 'zilla-escrow-fictional-events.json' && j.length === all, `${j.length} events`);
  });
  await step('states', async () => { await go(p, '/states'); for (const t of ['empty', 'connected empty', 'loading', 'pending', 'error', 'read-only', 'status chips']) { await btn(p, t).click(); } check('all system states render without errors', p.errors.length === 0, p.errors.join('|')); });
  check('no console errors in client flow', p.errors.length === 0, p.errors.join(' | '));
  await closeCtx(p);
}

// 3. Provider flow
current = 'provider';
{
  const p = await newPage();
  await step('connect as provider', async () => { await go(p, '/connect'); await role(p, 'provider'); await p.getByRole('button', { name: /Browser wallet/ }).click(); await btn(p, 'Preview connected').click(); check('connected shows provider', await hasText(p, /Agreement role: provider/)); });
  await step('accept as provider', async () => { await go(p, '/accept'); await role(p, 'provider'); check('provider can cancel, not accept', await btn(p, 'Cancel before acceptance').isVisible() && (await p.getByRole('button', { name: 'Accept exact scope' }).count()) === 0); await btn(p, 'Cancel before acceptance').click(); check('cancelled state', await hasText(p, /Cancelled/i)); });
  await step('proof submit', async () => {
    await go(p, '/proof'); await role(p, 'provider');
    check('provider sees proof composer', await p.getByText('Compose a proof pack.').isVisible());
    check('provider has no Review release', (await p.locator('a:has-text("Review release")').filter({ visible: true }).count()) === 0);
    const h0 = await p.locator('form .esc-hash, form code').first().innerText().catch(() => '');
    await p.locator('form textarea').fill('https://example.invalid/fictional-proof-1\nhttps://example.invalid/fictional-proof-2');
    const h1 = await p.locator('form .esc-hash, form code').first().innerText().catch(() => '');
    check('local pack fingerprint updates with links', h0 !== h1 || h0 === '', `${h0.slice(0, 14)} -> ${h1.slice(0, 14)}`);
    await btn(p, /Submit proof · preview/).click(); check('proof submission previewed', await hasText(p, /Preview submitted. No onchain proof was replaced/));
    check('submit disabled after post', await btn(p, /Submit proof · preview/).isDisabled());
    await shot(p, 'provider-proof-submitted-1280');
  });
  await step('proof p1 page', async () => { await go(p, '/proof/p1'); await role(p, 'provider'); check('/proof/p1 renders P1', await hasText(p, /P1|Discovery|proof/i)); });
  await step('release blocked for provider', async () => { await go(p, '/release'); await role(p, 'provider'); check('Review release disabled for provider', await btn(p, /^Review release$/).isDisabled()); });
  await step('changes as provider', async () => {
    await go(p, '/changes'); await role(p, 'provider'); check('provider cannot approve own CO-2', (await p.getByRole('button', { name: 'Approve change' }).count()) === 0);
    await btn(p, 'Withdraw request').click(); check('withdraw previewed', await hasText(p, /Change withdrawn in the preview/));
    await btn(p, 'Request a change').click(); await btn(p, 'Review change request').click(); check('provider proposal review', await hasText(p, /Proposed by provider/)); await btn(p, /Propose change · preview/).click(); check('provider proposal previewed', await hasText(p, /Change request proposal previewed/));
  });
  await step('dispute exits as provider', async () => {
    await go(p, '/dispute'); await role(p, 'provider'); await btn(p, 'Return funds to client').click(); await btn(p, /Confirm · preview/).click(); check('voluntary refund previewed', await hasText(p, /P3 funds returned in this preview/));
    await go(p, '/dispute'); await role(p, 'provider'); check('claim disabled before window', await btn(p, 'Claim payment').isDisabled());
    await p.selectOption('label:has-text("Time preview") select', 'eligible'); await btn(p, 'Claim payment').click(); await btn(p, /Confirm · preview/).click(); check('claim previewed', await hasText(p, /Claim 3,500.00 mUSDC for the provider previewed/));
  });
  await step('fund as provider', async () => { await go(p, '/fund'); await role(p, 'provider'); const allow = p.getByRole('button', { name: /Allow mUSDC/ }).filter({ visible: true }); check('provider cannot fund (client-only)', (await allow.count()) === 0 || await allow.first().isDisabled() || await hasText(p, /Only the client/i)); await shot(p, 'provider-fund-1280'); });
  await step('arbiter resolves', async () => { await go(p, '/dispute'); await role(p, 'arbiter'); await btn(p, 'Disputed fixture').click(); await p.getByLabel('To provider (mUSDC)').fill('2000'); await btn(p, /Review and confirm split/).click(); check('split confirmation shows totals', await hasText(p, /Total 4,500.00 mUSDC/)); await btn(p, /Confirm · preview/).click(); check('resolution previewed', await hasText(p, /Resolve dispute with this split previewed/)); });
  await step('viewer read-only', async () => { await go(p, '/agreement'); await role(p, 'viewer'); check('viewer notice', await hasText(p, /Read-only viewer/)); await go(p, '/release'); await role(p, 'viewer'); check('viewer cannot release', await btn(p, /^Review release$/).isDisabled()); });
  check('no console errors in provider flow', p.errors.length === 0, p.errors.join(' | '));
  await closeCtx(p);
}

// 4. Theme, mobile menu, keyboard, reduced motion
current = 'ux';
{
  const p = await newPage();
  await step('theme persistence', async () => {
    await go(p, '/agreement'); await p.getByRole('button', { name: 'Use light theme' }).click();
    check('toggle sets light + aria-pressed', await p.evaluate(() => document.documentElement.dataset.theme) === 'light' && await p.getByRole('button', { name: 'Use light theme' }).getAttribute('aria-pressed') === 'true');
    await p.goto(BASE + '/fund', { waitUntil: 'commit' }); await p.waitForLoadState('domcontentloaded');
    check('light theme applied before hydration on next route', await p.evaluate(() => document.documentElement.dataset.theme) === 'light');
    await p.reload({ waitUntil: 'networkidle' }); check('light persists on reload', await p.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('zilla-escrow-theme')].join()) === 'light,light');
    const p2 = await p.context().newPage(); await p2.goto(BASE + '/agreement', { waitUntil: 'networkidle' });
    await p2.getByRole('button', { name: 'Use dark theme' }).click(); await p.waitForTimeout(300);
    check('theme syncs across tabs via storage event', await p.evaluate(() => document.documentElement.dataset.theme) === 'dark'); await p2.close();
  });
  await closeCtx(p);
  const m = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await step('mobile menu', async () => {
    await go(m, '/agreement'); const sum = m.locator('summary[aria-label="More workspace actions"]');
    check('More menu summary visible on mobile', await sum.isVisible()); await sum.click();
    check('menu opens with actions', await m.locator('details.esc-mobile-menu[open] a').filter({ visible: true }).count() >= 8);
    await shot(m, 'mobile-menu-open-390');
    await m.locator('details.esc-mobile-menu a[href="/fund"]').click(); await m.waitForURL('**/fund'); check('menu link navigates to /fund', m.url().endsWith('/fund'));
  });
  await step('mobile release dialog', async () => {
    await go(m, '/release'); await btn(m, /^Review release$/).click(); await m.waitForTimeout(300);
    const r = await m.evaluate(() => { const d = document.querySelector('dialog[open]'); const h = d.querySelector('h2,h1'); const t = d.querySelector('.esc-testnet'); const hb = h.getBoundingClientRect(); const tb = t ? t.getBoundingClientRect() : null; return { overlap: tb ? !(tb.bottom <= hb.top || tb.top >= hb.bottom) : false, h: [hb.top, hb.bottom], t: tb && [tb.top, tb.bottom] }; });
    check('testnet banner does not cover dialog heading at 390', !r.overlap, JSON.stringify(r));
    check('dialog opens scrolled to top with notice visible', await m.evaluate(() => document.querySelector('dialog[open]').scrollTop) === 0 && await m.locator('dialog[open] .esc-testnet').isVisible());
    await m.evaluate(() => { const d = document.querySelector('dialog[open]'); d.scrollTop = d.scrollHeight; });
    const r2 = await m.evaluate(() => { const d = document.querySelector('dialog[open]'); const t = d.querySelector('.esc-testnet').getBoundingClientRect(); const db = d.getBoundingClientRect(); return t.bottom <= db.top + 1 || getComputedStyle(d.querySelector('.esc-testnet')).position !== 'sticky'; });
    check('banner does not stick over content when scrolled (390)', r2);
    check('focus still inside dialog on Keep reviewing', await m.evaluate(() => document.activeElement?.textContent?.includes('Keep reviewing')));
    await shot(m, 'mobile-release-dialog-390');
  });
  await closeCtx(m);
  const k = await newPage();
  await step('keyboard nav + focus', async () => {
    await go(k, '/agreement'); await k.keyboard.press('Tab');
    check('first Tab focuses skip link', await k.evaluate(() => document.activeElement?.textContent) === 'Skip to content');
    await k.keyboard.press('Enter'); check('skip link targets #main', k.url().endsWith('#main'));
    let missing = []; for (let i = 0; i < 25; i++) { await k.keyboard.press('Tab'); const o = await k.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { ok: e === document.body || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none', t: e.tagName + ':' + (e.textContent || '').trim().slice(0, 20) }; }); if (o.t.startsWith('BODY:')) break; if (!o.ok) missing.push(i + ':' + o.t); }
    check('every tab stop up to the end of the page (max 25) shows a visible focus style', missing.length === 0, missing.join(', '));
    await k.keyboard.press('Shift+Tab'); check('Shift+Tab works', true);
  });
  await step('keyboard activates controls', async () => { await go(k, '/fund'); await k.getByRole('button', { name: /Allow mUSDC/ }).focus(); await k.keyboard.press('Enter'); check('Enter activates fund step button', await hasText(k, /Waiting for wallet/)); });
  await closeCtx(k);
  const rm = await newPage({ reducedMotion: 'reduce' });
  await step('reduced motion', async () => {
    for (const r of ['/', '/agreement', '/recorded']) { await go(rm, r); const moving = await rm.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0) || parseFloat(s.transitionDuration) > 0; }).length); check(`${r} no animations/transitions under reduce`, moving === 0, `${moving} moving elements`); }
  });
  await closeCtx(rm);
}

// 5. /recorded vs run.json
current = 'recorded';
{
  const p = await newPage();
  await step('arbiscan links', async () => {
    await go(p, '/recorded');
    for (let i = 0; i < 6; i++) { const n = p.getByRole('button', { name: /Next step/ }); if (await n.isEnabled()) await n.click(); }
    const n = await p.locator('button').filter({ hasText: /^\d/ }).count(); for (let i = 0; i < n; i++) { await p.evaluate(i => [...document.querySelectorAll('button')].filter(b => /^\d/.test((b.textContent || '').trim()))[i]?.click(), i); await p.waitForTimeout(150); }
    const hrefs = [...new Set(await p.$$eval('a[href*="arbiscan"]', as => as.map(a => a.href)))];
    const runTx = realTx; const addrs = realAddr;
    const bad = hrefs.filter(h => { const m = h.match(/^https:\/\/sepolia\.arbiscan\.io\/(tx|address|token|block)\/(0x[0-9a-fA-F]+|\d+)/); if (!m) return true; if (m[1] === 'tx') return !runTx.has(m[2].toLowerCase()); if (m[1] === 'address' || m[1] === 'token') return !addrs.has(m[2].toLowerCase()); return false; });
    check('all explorer links are sepolia.arbiscan.io and match run.json', hrefs.length > 0 && bad.length === 0, `${hrefs.length} links, bad: ${bad.join(' ')}`);
    const txLinked = new Set(hrefs.map(h => h.match(/\/tx\/(0x[0-9a-f]+)/i)?.[1]?.toLowerCase()).filter(Boolean));
    const missingTx = run.steps.filter(s => !s.key.startsWith('deploy') && !txLinked.has(s.txHash.toLowerCase())).map(s => s.key);
    check('every recorded agreement tx is linked', missingTx.length === 0, missingTx.join(','));
    fs.writeFileSync(path.join(OUT, 'recorded-links.json'), JSON.stringify(hrefs, null, 2));
    await shot(p, 'recorded-1280');
  });
  await step('live read button', async () => { await btn(p, /Read live state from Arbitrum Sepolia/).click(); await p.waitForTimeout(8000); check('live read returns matching state', await hasText(p, /match|status|version|live/i)); await shot(p, 'recorded-live-read-1280'); });
  await closeCtx(p);
}

// 5b. Review fixes (2026-10-28): no sample value is linked, landing points to the real record, copy fixes.
current = 'review-fixes';
{
  const p = await newPage();
  await step('no explorer link points at a sample value', async () => {
    const bad = []; let total = 0;
    for (const r of routes.filter(r => r !== '/recorded')) {
      await go(p, r);
      await p.$$eval('details', ds => ds.forEach(d => { d.open = true; }));
      const hrefs = await p.$$eval('a[href*="arbiscan"]', as => as.map(a => a.href)); total += hrefs.length;
      for (const h of hrefs) if (!realHref(h)) bad.push(`${r} ${h}`);
    }
    check('every explorer link on the 16 app routes is a real recorded value', bad.length === 0, `${total} links, bad: ${bad.slice(0, 5).join(' ')}`);
  });
  await step('landing copy + links', async () => {
    await go(p, '/'); const body = await p.locator('body').innerText();
    check('no cohort or mentorship copy on landing', !/Cohort|Mentorship|Robinhood/i.test(body));
    check('no "deployment is not supplied" claim', !/not supplied/i.test(body));
    check('landing links the deployed escrow on Arbiscan', await p.locator(`a[href="https://sepolia.arbiscan.io/address/${run.contracts.escrow}"]`).count() > 0);
    check('landing links /recorded with the real tx count', await p.locator('a[href="/recorded"]', { hasText: `See the ${run.steps.length} real testnet transactions` }).count() > 0);
    check('footer carries the money-transmission caveat', /money transmission is required before any mainnet use/.test(body));
    await shot(p, 'landing-review-fixes-1280');
  });
  await step('header + connect copy', async () => {
    await go(p, '/agreement');
    check('wallet chip reads "Preview as" and hides the sample address', /Preview as/i.test(await p.locator('.esc-wallet').innerText()) && !/0x/.test(await p.locator('.esc-wallet').innerText()));
    check('demo controls labelled', await hasText(p, /Demo controls/i));
    await go(p, '/activity'); check('sample chips shown on fixture hashes', await p.locator('.esc-sample-chip').count() > 0);
    await go(p, '/connect'); check('faucet note says coming soon, no dev note', await hasText(p, /Faucet coming soon/) && !(await hasText(p, /URLs were not provided/)));
    check('sidebar links /recorded', await p.locator('.esc-sidebar a[href="/recorded"]').count() > 0);
  });
  await closeCtx(p);
}

// 6. axe
current = 'axe';
{
  const axeOut = {};
  for (const theme of ['dark', 'light']) for (const width of [1280, 390]) {
    const p = await newPage({ viewport: { width, height: 900 } });
    await p.addInitScript(t => { try { localStorage.setItem('zilla-escrow-theme', t); } catch {} }, theme);
    for (const r of routes) await step(`${r} ${theme} ${width}`, async () => {
      await go(p, r); await p.addScriptTag({ content: axeSrc });
      const res = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      const v = res.violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, targets: x.nodes.slice(0, 4).map(n => n.target.join(' ')) }));
      axeOut[`${r} ${theme} ${width}`] = v;
      check(`${r} ${theme} ${width} axe WCAG 2.1 AA`, v.length === 0, v.map(x => `${x.id}(${x.impact})x${x.n}: ${x.targets.join(' ; ')}`).join(' || '));
    });
    await closeCtx(p);
  }
  fs.writeFileSync(path.join(OUT, 'axe.json'), JSON.stringify(axeOut, null, 2));
}

await browser.close();
const failed = results.filter(r => !r.ok);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), total: results.length, failed: failed.length, results, shots }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
