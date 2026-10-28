// axe WCAG 2.1 AA against a DEPLOYED (password-gated) preview: every route plus /unlock,
// at 1280 and 390, in dark and light themes. Also records the served CSS tokens so a stale
// build cache shows up. The gate password is read in-process from GATE_ENV and never logged.
// Usage: GATE_ENV=/path/demo.env BASE=https://<preview> OUT=../docs/screenshots/axe-deployed node e2e/axe-deployed.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { readGatePassword, unlock } from './gate-lib.mjs';
const req = createRequire(path.join(process.env.PW_DIR ?? '/workspace/pwshot', 'x.js'));
const { chromium } = req('playwright-core');
const axeSrc = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = (process.env.BASE ?? '').replace(/\/$/, '');
if (!BASE) throw new Error('BASE is required');
const OUT = process.env.OUT ?? path.resolve('../docs/screenshots/axe-deployed');
fs.mkdirSync(OUT, { recursive: true });
const password = readGatePassword();
const routes = ['/unlock', '/', '/connect', '/create', '/accept', '/agreement', '/milestones', '/timeline', '/scope', '/fund', '/proof', '/proof/p1', '/release', '/changes', '/dispute', '/activity', '/states', '/recorded'];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = { base: BASE, ranAt: new Date().toISOString(), axeVersion: null, tags, runs: {}, tokens: {}, total: 0, violations: 0, errors: [] };
for (const theme of ['dark', 'light']) for (const width of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addInitScript(t => { try { localStorage.setItem('zilla-escrow-theme', t); } catch {} }, theme);
  const p = await ctx.newPage();
  // /unlock is checked before unlocking; the rest after.
  for (const r of routes) {
    const key = `${r} ${theme} ${width}`;
    try {
      if (r === '/') { if (password) await unlock(p, BASE, password, '/'); else throw new Error('no gate password'); }
      const resp = await p.goto(`${BASE}${r}`, { waitUntil: 'networkidle', timeout: 60000 });
      const landed = new URL(p.url()).pathname;
      if (r !== '/unlock' && landed.startsWith('/unlock')) throw new Error(`still gated on ${r}`);
      await p.addScriptTag({ content: axeSrc });
      const res = await p.evaluate(async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), tags);
      results.axeVersion ??= res.testEngine?.version ?? null;
      const v = res.violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, targets: x.nodes.slice(0, 4).map(n => n.target.join(' ')) }));
      results.runs[key] = { status: resp?.status() ?? null, path: landed, theme: await p.evaluate(() => document.documentElement.dataset.theme ?? null), violations: v };
      results.total++; results.violations += v.length;
      console.log(`${v.length ? 'FAIL' : 'PASS'} ${key}${v.length ? ' :: ' + v.map(x => `${x.id}(${x.impact})x${x.n}: ${x.targets.join(' ; ')}`).join(' || ') : ''}`);
      if (r === '/recorded') results.tokens[`${theme} ${width}`] = await p.evaluate(async () => {
        const css = (await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(l => fetch(l.href).then(x => x.text())))).join('\n');
        const pick = n => [...new Set([...css.matchAll(new RegExp(`${n}:\\s*([^;}]+)`, 'g'))].map(m => m[1].trim()))];
        return { '--color-dim': pick('--color-dim'), '--color-zilla-soft': pick('--color-zilla-soft') };
      });
    } catch (e) { results.errors.push(`${key}: ${e.message}`); console.log(`ERROR ${key}: ${e.message}`); }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'axe-deployed.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`axe deployed: ${results.total} page runs, ${results.violations} violations, ${results.errors.length} errors`);
process.exit(results.violations || results.errors.length ? 1 : 0);
