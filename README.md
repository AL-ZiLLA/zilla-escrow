# Zilla Escrow

Milestone escrow for agent-run service work, built on Arbitrum by Zilla Labs ([@zillalabs_ai](https://x.com/zillalabs_ai)).

A provider turns a signed scope into an on-chain agreement. The client funds each phase, the delivery agent posts a proof pack, and the client releases with one click. Change orders add funds and move dates only when both sides agree, and every step leaves an audit trail.

> **Testnet demo only.** Payments use a mock token with no value. Every name, amount and deliverable in this repo is fictional. The contract is not audited, and legal review of escrow and money transmission comes before any mainnet use.

## What is in here

| Path | What it is |
| --- | --- |
| `contracts/` | Foundry project: `ZillaEscrow.sol`, a mock stablecoin, unit, fuzz, invariant and reentrancy tests, and a deploy script |
| `web/` | Next.js demo that replays a recorded run: create from scope, fund, proof, one-click release, change order, audit trail |
| `design-handoff/` | Brief, synthetic sample data, contract model and official brand assets for an outside designer. Start with `design-handoff/README.md` |
| `docs/` | Self-grading scorecard and screenshots |

## How the contract works

- **Agreement.** `createAgreement` stores the client, provider, delivery agent, token, phases and a `scopeHash` (keccak256 of the canonical scope JSON). `acceptAgreement` has the client confirm that exact hash, which freezes it as `baselineHash`.
- **Phases.** `fundMilestone` pulls the phase payment into escrow. The agent or provider calls `submitProof` with a proof hash and URI. The client calls `release`.
- **Change orders.** `proposeChangeOrder` prices a change against the current scope version (top up a phase or add one, move a due date, new scope hash). `approveChangeOrder` applies it and bumps the version. Stale change orders cannot be approved.
- **Safety valves.** `claimAfterReview` pays the provider if the client goes silent after proof. `refundExpired` returns a funded phase after its due date if no proof arrived. `openDispute` freezes a phase and a named arbiter splits it with `resolveDispute`.
- **No admin.** No owner, pause or upgrade path. State-changing calls are non-reentrant, and fee-on-transfer tokens are rejected so held funds always equal the token balance.

## Run it

Requirements: [Foundry](https://book.getfoundry.sh/), Node 20+, pnpm.

```bash
git clone --recurse-submodules https://github.com/AL-ZiLLA/zilla-escrow
cd zilla-escrow/contracts
forge test                 # unit, fuzz and invariant suites
forge coverage --report summary

cd ../web
pnpm install
pnpm dev                   # http://localhost:3000
```

### Record a run

`web/scripts/run-demo.ts` deploys the token and escrow, plays the full flow with five role keys and writes `web/src/data/run.json`, which the page renders.

Keys live in an env file **outside the repo** with `DEPLOYER_PK`, `CLIENT_PK`, `PROVIDER_PK`, `AGENT_PK` and `ARBITER_PK`. Use throwaway testnet keys only.

```bash
# Local rehearsal on anvil
anvil &
KEYS_FILE=/path/outside/repo/testnet.env pnpm demo:run

# Arbitrum Sepolia (chain 421614), deployer funded from a faucet
KEYS_FILE=/path/outside/repo/testnet.env NETWORK=arbitrum-sepolia \
  RPC_URL=https://sepolia-rollup.arbitrum.io/rpc pnpm demo:run
```

The deploy script refuses any chain other than Arbitrum Sepolia (421614) or a local anvil (31337).

## Status

- Contracts and tests: done locally.
- Demo app: replays a local anvil rehearsal. It switches to Arbitrum Sepolia explorer links once the same run is recorded there.
- Not audited. Legal review before mainnet.

Internal planning index: Zilla brain `note-20261027-050`.
