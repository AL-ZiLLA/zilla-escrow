/* eslint-disable @typescript-eslint/no-explicit-any -- read-only RPC check script, decoded log args are untyped */
// Read-only check of the recorded Arbitrum Sepolia run against the live chain. No keys, no writes.
import { createPublicClient, http, decodeEventLog, getAddress } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { escrowAbi, tokenAbi } from '../src/lib/abi';
import run from '../src/data/run.json' with { type: 'json' };

const client = createPublicClient({ chain: arbitrumSepolia, transport: http(process.env.RPC ?? 'https://sepolia-rollup.arbitrum.io/rpc') });
const results: { check: string; ok: boolean; detail?: string }[] = [];
const ok = (check: string, cond: boolean, detail?: string) => results.push({ check, ok: cond, detail });
const norm = (v: unknown): unknown => typeof v === 'bigint' ? v.toString() : typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : v;

const escrow = getAddress(run.contracts.escrow), token = getAddress(run.contracts.token);
ok('chainId 421614', (await client.getChainId()) === run.network.chainId);
const ec = await client.getCode({ address: escrow }); ok('escrow has code', !!ec && ec.length > 2, `${((ec?.length ?? 2) - 2) / 2} bytes`);
const tc = await client.getCode({ address: token }); ok('token has code', !!tc && tc.length > 2, `${((tc?.length ?? 2) - 2) / 2} bytes`);

for (const step of run.steps as any[]) {
  const r = await client.getTransactionReceipt({ hash: step.txHash });
  ok(`${step.key}: status success`, r.status === 'success');
  ok(`${step.key}: block ${step.block}`, Number(r.blockNumber) === step.block, String(r.blockNumber));
  if (step.key.startsWith('deploy-')) {
    const want = step.key === 'deploy-ZillaEscrow' ? escrow : token;
    ok(`${step.key}: created ${want}`, r.contractAddress?.toLowerCase() === want.toLowerCase(), r.contractAddress ?? 'none');
    continue;
  }
  const decoded = r.logs.map(l => { for (const abi of [escrowAbi, tokenAbi]) { try { return decodeEventLog({ abi: abi as any, data: l.data, topics: l.topics as any }); } catch {} } return null; }).filter(Boolean) as any[];
  const want = (step.events ?? []) as any[];
  ok(`${step.key}: event names`, JSON.stringify(decoded.map(e => e.eventName)) === JSON.stringify(want.map(e => e.name)), decoded.map(e => e.eventName).join(','));
  let argsOk = true; const diffs: string[] = [];
  want.forEach((w, i) => { for (const [k, v] of Object.entries(w.args ?? {})) { const got = norm(decoded[i]?.args?.[k]); if (String(got) !== String(norm(v))) { argsOk = false; diffs.push(`${w.name}.${k}`); } } });
  ok(`${step.key}: event args`, argsOk, diffs.join(','));
  const fromWant = (run.roles as any)[step.role];
  if (fromWant) { const tx = await client.getTransaction({ hash: step.txHash }); ok(`${step.key}: sender is ${step.role}`, tx.from.toLowerCase() === fromWant.toLowerCase()); }
}

const ag: any = await client.readContract({ address: escrow, abi: escrowAbi, functionName: 'getAgreement', args: [BigInt(run.agreementId)] });
const f: any = run.final.agreement;
for (const k of ['client', 'provider', 'agent', 'arbiter', 'token', 'status', 'version', 'milestoneCount', 'changeOrderCount', 'scopeHash', 'baselineHash']) {
  ok(`final agreement.${k}`, String(norm(ag[k])) === String(norm(f[k])), `${norm(ag[k])}`);
}
const ms: any = await client.readContract({ address: escrow, abi: escrowAbi, functionName: 'getMilestones', args: [BigInt(run.agreementId)] });
(run.final.milestones as any[]).forEach((m, i) => { for (const k of ['amount', 'funded', 'status', 'proofHash']) ok(`final milestone[${i}].${k}`, String(norm(ms[i]?.[k])) === String(norm(m[k])), `${norm(ms[i]?.[k])}`); });
const bal = await client.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [escrow] });
ok('escrow token balance = sum of funded', bal === (run.final.milestones as any[]).reduce((s, m) => s + BigInt(m.funded), 0n), bal.toString());

const fail = results.filter(r => !r.ok);
console.log(JSON.stringify({ total: results.length, failed: fail.length, results }, null, 2));
process.exit(fail.length ? 1 : 0);
