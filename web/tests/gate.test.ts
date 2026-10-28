import test from 'node:test';
import assert from 'node:assert/strict';
import { gateMode, issueToken, verifyToken, checkPassword, safeNext, GATE_MAX_AGE } from '../src/lib/gate/token';
import {
  EMPTY, LOCK_MS, MAX_FAILS, MAX_LOCK_MS, WINDOW_MS, afterFail, decodeTries, encodeTries, failDelayMs, lockedFor, stricter,
} from '../src/lib/gate/rateLimit';

// Fixture values only; not the deployed password or secret.
const config = { password: 'fixture-pass-0000', secret: 'f'.repeat(48) };

test('gate is off locally without a password and fails closed on Vercel', () => {
  assert.equal(gateMode({}).mode, 'off');
  assert.equal(gateMode({ VERCEL: '1' }).mode, 'misconfigured');
  assert.equal(gateMode({ DEMO_PASSWORD: 'x', DEMO_GATE_SECRET: 'short' }).mode, 'misconfigured');
  assert.equal(gateMode({ DEMO_PASSWORD: config.password, DEMO_GATE_SECRET: config.secret }).mode, 'on');
});

test('password compare accepts only the exact password', () => {
  assert.equal(checkPassword(config, config.password), true);
  assert.equal(checkPassword(config, config.password + ' '), false);
  assert.equal(checkPassword(config, ''), false);
});

test('tokens verify, expire after 30 days, and die when the password or secret rotates', () => {
  const now = Date.UTC(2026, 9, 28);
  const token = issueToken(config, now);
  assert.equal(verifyToken(config, token, now), true);
  assert.equal(verifyToken(config, token, now + (GATE_MAX_AGE + 1) * 1000), false);
  assert.equal(verifyToken({ ...config, password: 'other' }, token, now), false);
  assert.equal(verifyToken({ ...config, secret: 'g'.repeat(48) }, token, now), false);
  const [exp, sig] = token.split('.');
  assert.equal(verifyToken(config, `${Number(exp) + 999}.${sig}`, now), false);
  for (const bad of [undefined, '', 'abc', '.sig', 'x.sig']) assert.equal(verifyToken(config, bad, now), false);
});

test('next redirects stay on this site', () => {
  for (const ok of ['/', '/fund?x=1', '/agreement#m2', '/recorded?tab=tx&x=%2F%2Fa', '/unlockrecorded'])
    assert.equal(safeNext(ok), ok);
  const bad = [
    null, undefined, '', 'fund', 'https://evil.example', 'http:evil.example', 'javascript:alert(1)', 'data:text/html,x',
    '//evil.example', '///evil.example', '/\\evil.example', '\\\\evil.example', '/x\\..\\..\\evil',
    // Tab, CR, LF and other control or space characters are stripped or folded by URL parsing.
    '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/ /evil.example', '/\u0000/evil', '/\u007f/evil', '/\u0085/evil',
    ' /fund', '/fund ', '/unlock', '/unlock?next=/', '/unlock/x', '/./unlock', '/a/../unlock', '/..//evil.example',
    '/' + 'a'.repeat(2000),
  ];
  for (const b of bad) assert.equal(safeNext(b as string), '/', JSON.stringify(b));
  // Whatever survives must resolve to the same origin against any base.
  for (const b of bad) assert.equal(new URL(safeNext(b as string), 'https://app.example').origin, 'https://app.example');
});

test('rate limit locks out after 5 failures in 15 minutes, with doubling lockouts', () => {
  const now = 1_000_000_000;
  let t = EMPTY;
  for (let i = 1; i < MAX_FAILS; i++) { t = afterFail(t, now + i); assert.equal(lockedFor(t, now + i), 0); assert.equal(t.count, i); }
  t = afterFail(t, now + MAX_FAILS);
  assert.equal(lockedFor(t, now + MAX_FAILS), LOCK_MS);
  assert.equal(lockedFor(t, now + MAX_FAILS + LOCK_MS), 0);
  const second = (() => { let u = t; const s = now + MAX_FAILS + LOCK_MS + 1; for (let i = 0; i < MAX_FAILS; i++) u = afterFail(u, s); return { u, s }; })();
  assert.equal(lockedFor(second.u, second.s), LOCK_MS * 2);
  let cap = { ...t, lockouts: 10 };
  for (let i = 0; i < MAX_FAILS; i++) cap = afterFail({ ...cap, lockedUntil: 0 }, now);
  assert.equal(lockedFor(cap, now), MAX_LOCK_MS);
});

test('failures outside the window start a new count, and delays grow', () => {
  const t = afterFail(afterFail(EMPTY, 0), 1);
  assert.equal(t.count, 2);
  assert.equal(afterFail(t, WINDOW_MS + 2).count, 1);
  assert.deepEqual([1, 2, 3, 4, 9].map((count) => failDelayMs({ ...EMPTY, count })), [500, 1000, 2000, 4000, 4000]);
});

test('attempt cookie is signed: tampering or another secret resets nothing and grants nothing', () => {
  const t = { count: 3, start: 123, lockedUntil: 456, lockouts: 1 };
  const v = encodeTries(config.secret, t);
  assert.deepEqual(decodeTries(config.secret, v), t);
  assert.deepEqual(decodeTries('g'.repeat(48), v), EMPTY);
  assert.deepEqual(decodeTries(config.secret, v.replace(/^3\./, '0.')), EMPTY);
  for (const bad of [undefined, '', 'x', '1.2.3.4', '-1.2.3.4.sig']) assert.deepEqual(decodeTries(config.secret, bad), EMPTY);
  // The stricter record wins, so dropping the cookie cannot undo the memory lockout.
  const locked = { ...EMPTY, lockedUntil: 999, lockouts: 1 };
  assert.equal(stricter(EMPTY, locked), locked);
  assert.equal(stricter(locked, { ...EMPTY, count: 4 }), locked);
});
