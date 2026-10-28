/**
 * Arbitrum Sepolia deployment recorded by scripts/run-demo.ts (see src/data/run.json
 * and the /recorded page). This is the single source for real testnet addresses.
 *
 * The v2 review UI under src/components/escrow still renders fictional fixtures with
 * placeholder addresses. Do not show these addresses as receipts for those fixtures.
 * A production adapter should read from here once OPEN-QUESTIONS.md item 1 (deployment
 * block, ABI commit and whether this deployment is the one to wire) is confirmed by Al.
 */
import { run } from "@/lib/run";

export const deployment = {
  network: run.network,
  escrow: run.contracts.escrow as `0x${string}`,
  token: run.contracts.token as `0x${string}`,
  deployBlock: run.contracts.deployBlock,
} as const;
