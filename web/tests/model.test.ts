import test from 'node:test';
import assert from 'node:assert/strict';
import {sample, money, units, impact, canClaim, canRefund, canRelease, canAnswer, canDispute, type Role} from '../src/lib/escrow/model';
test('formats base units exactly without floating point or dollar signs',()=>{
  assert.equal(money(3500000000),'3,500.00 mUSDC');
  assert.equal(money(12345678901234567890000n),'12,345,678,901,234,567.89 mUSDC');
  assert.equal(units('3500.00'),3500000000n);
  assert.throws(()=>units('1.1234567'));assert.throws(()=>units('-1'));
});
test('CO-2 extends P3 without silently moving P4 or the project end',()=>{
  const v=impact(2,500000000n,'2027-01-22');
  assert.equal(v.days,7);assert.equal(v.endDays,0);assert.equal(v.endAfter,'2027-01-29');
  assert.equal(v.totalAfter,12300000000n);assert.equal(v.milestoneAfter,5000000000n);
});
test('provider claim and client refund honor different exact boundaries',()=>{
  const submitted=sample.escrow.milestones[1],funded=sample.escrow.milestones[2];
  assert.equal(canClaim(submitted,'provider','2026-12-24T18:29:59Z'),false);
  assert.equal(canClaim(submitted,'provider','2026-12-24T18:30:00Z'),true);
  assert.equal(canClaim(submitted,'client','2026-12-25T18:30:00Z'),false);
  assert.equal(canRefund(funded,'client','2027-01-22T00:00:00Z'),false);
  assert.equal(canRefund(funded,'client','2027-01-22T00:00:01Z'),true);
  assert.equal(canRefund(submitted,'client','2027-01-23T00:00:01Z'),false);
});
test('money actions follow contract role and milestone status',()=>{
  const roles:Role[]=['client','provider','agent','arbiter','viewer'];
  for(const role of roles){assert.equal(canRelease(sample.escrow.milestones[1],role),role==='client');assert.equal(canDispute(sample.escrow.milestones[2],role),role==='client'||role==='provider');}
  assert.equal(canRelease({...sample.escrow.milestones[1],funded:0},'client'),false);
  assert.equal(canDispute(sample.escrow.milestones[0],'client'),false);
  assert.equal(canAnswer(sample.escrow.change_orders[1],'provider',2),false);
  assert.equal(canAnswer(sample.escrow.change_orders[1],'client',2),true);
  assert.equal(canAnswer(sample.escrow.change_orders[1],'client',3),false);
});
test('fixture accounting is internally consistent',()=>{
  const t=sample.escrow.totals;
  assert.equal(t.contract_total,t.escrow_balance+t.released+t.unfunded+t.refunded);
  assert.equal(t.escrow_balance,sample.escrow.milestones.reduce((s,m)=>s+m.funded,0));
});
