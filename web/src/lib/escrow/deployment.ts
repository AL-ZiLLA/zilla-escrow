/**
 * Arbitrum Sepolia deployment recorded by scripts/run-demo.ts (see src/data/run.json
 * and the /recorded page). This is the single source for real testnet addresses.
 *
 * The v2 review UI under src/components/escrow renders fictional fixtures with sample
 * hashes and addresses. Only values in `recordedValues` (this run, plus the prior
 * version's run) may become explorer links; everything else renders unlinked with a
 * visible "sample" chip. See HashValue.tsx.
 */
import { run } from "@/lib/run";
import priorRun from "@/data/run-v1.json";

export const deployment = {
  network: run.network,
  escrow: run.contracts.escrow as `0x${string}`,
  token: run.contracts.token as `0x${string}`,
  deployBlock: run.contracts.deployBlock,
  txCount: run.steps.length,
} as const;

/** The first deployment (before the 2026-10-28 review fixes). Kept for the record only. */
export const priorDeployment = {
  escrow: priorRun.contracts.escrow as `0x${string}`,
  token: priorRun.contracts.token as `0x${string}`,
  deployBlock: priorRun.contracts.deployBlock,
} as const;

const values = new Set<string>();
for (const r of [run, priorRun as unknown as typeof run]) {
  values.add(r.contracts.escrow.toLowerCase());
  values.add(r.contracts.token.toLowerCase());
  for (const a of Object.values(r.roles)) values.add(a.toLowerCase());
  for (const s of r.steps) values.add(s.txHash.toLowerCase());
}
export const recordedValues: ReadonlySet<string> = values;
export const isRecorded = (v: string) => recordedValues.has(v.toLowerCase());
