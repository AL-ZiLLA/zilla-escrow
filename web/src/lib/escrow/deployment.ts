/**
 * Arbitrum Sepolia deployment recorded by scripts/run-demo.ts (see src/data/run.json
 * and the /recorded page). This is the single source for real testnet addresses.
 *
 * The v2 review UI under src/components/escrow renders fictional fixtures with sample
 * hashes and addresses. Only values in `recordedValues` (this run, plus the prior
 * versions' runs) may become explorer links; everything else renders unlinked with a
 * visible "sample" chip. See HashValue.tsx.
 */
import { run } from "@/lib/run";
import runV1 from "@/data/run-v1.json";
import runV2 from "@/data/run-v2.json";

export const deployment = {
  network: run.network,
  escrow: run.contracts.escrow as `0x${string}`,
  token: run.contracts.token as `0x${string}`,
  deployBlock: run.contracts.deployBlock,
  txCount: run.steps.length,
} as const;

/** Earlier deployments, newest first. Superseded and kept for the record only. */
export const priorDeployments = [
  {
    label: "v2",
    note: "after the first review fixes, before the dispute and agent-binding fixes. Verified. Superseded.",
    escrow: runV2.contracts.escrow as `0x${string}`,
    token: runV2.contracts.token as `0x${string}`,
    deployBlock: runV2.contracts.deployBlock,
  },
  {
    label: "v1",
    note: "first deployment, before the 2026-10-28 review fixes. Superseded.",
    escrow: runV1.contracts.escrow as `0x${string}`,
    token: runV1.contracts.token as `0x${string}`,
    deployBlock: runV1.contracts.deployBlock,
  },
] as const;

const values = new Set<string>();
for (const r of [run, runV2 as unknown as typeof run, runV1 as unknown as typeof run]) {
  values.add(r.contracts.escrow.toLowerCase());
  values.add(r.contracts.token.toLowerCase());
  for (const a of Object.values(r.roles)) values.add(a.toLowerCase());
  for (const s of r.steps) values.add(s.txHash.toLowerCase());
}
export const recordedValues: ReadonlySet<string> = values;
export const isRecorded = (v: string) => recordedValues.has(v.toLowerCase());
