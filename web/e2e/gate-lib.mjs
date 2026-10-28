// Shared helpers for gated runs. The password is read from a local env file in-process
// and typed into the form; it is never logged or written to results.
import fs from 'node:fs';
export function readGatePassword(file = process.env.GATE_ENV) {
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').find(l => l.startsWith('DEMO_PASSWORD='));
  return line ? line.slice('DEMO_PASSWORD='.length).trim() : null;
}
export async function unlock(page, base, password, next = '/') {
  await page.goto(`${base}/unlock${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`, { waitUntil: 'networkidle' });
  await page.fill('input[name=password]', password);
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/unlock'), { timeout: 30000 }), page.click('button[type=submit]')]);
}
