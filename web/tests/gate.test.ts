import test from 'node:test';
import assert from 'node:assert/strict';
import { gateMode, issueToken, verifyToken, checkPassword, safeNext, GATE_MAX_AGE } from '../src/lib/gate/token';
import { isLimited, recordFail, clearFails } from '../src/lib/gate/rateLimit';

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

test('rate-limit-lite blocks after 8 failures in 10 minutes', () => {
  const key = 'test-client', now = 1_000_000;
  for (let i = 0; i < 8; i++) { assert.equal(isLimited(key, now), false); recordFail(key, now); }
  assert.equal(isLimited(key, now), true);
  assert.equal(isLimited(key, now + 11 * 60 * 1000), false);
  recordFail(key, now); clearFails(key);
  assert.equal(isLimited(key, now), false);
});
