# Zilla Escrow: E2E test report (2026-10-28)

Branch `ui-v2-integration`, PR #1 (not merged). Testnet only: Arbitrum Sepolia (chain 421614). Wallet and transaction actions in the escrow app are UI simulations; the real testnet record is at `/recorded`.

## Result: PASS

| Check | Result |
|---|---|
| Browser e2e (`web/e2e/e2e.mjs`, Chrome, 16 escrow routes + `/recorded`, dark/light, 1280 and 390) | **232/232 passed** (`docs/screenshots/e2e/results.json`) |
| axe WCAG 2.1 AA, every route, both themes, both widths | 0 violations (`axe.json`) |
| Onchain check (`web/e2e/chain-check.mts`): every recorded tx, event, balance and state read back from Arbitrum Sepolia | **93/93** (`chain-check.json`) |
| Every Arbiscan link in the UI points to a recorded address or tx | pass (`recorded-links.json`) |
| Foundry: 62 tests (unit, review-fix, fuzz, invariant) | 62/62 pass |
| Coverage of `src/ZillaEscrow.sol` and `src/mocks/MockStablecoin.sol` | 100% lines, statements, branches, functions |
| Deployed bytecode vs local `forge build` (`cast code`) | byte-identical for escrow and token |
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | green |
| Demo password gate + PWA (`web/e2e/gate-pwa.mjs`) on the deployed branch alias | **27/27** (`docs/screenshots/pwa/gate-pwa-results.json`) |
| Vercel preview | branch alias https://zilla-escrow-git-ui-v2-integration-al-zillas-projects.vercel.app (demo password gate; Vercel Authentication off for this project) |

## Deployment (current)

- Escrow: `0xc2fec2d41a795d75286d8e52192a09cd1a3c8dd2`
- Mock stablecoin: `0x34b161d6315c9874cec85d54c0ad7e8baa208eec`
- Deploy block 323719428; 14 recorded transactions in `web/src/data/run.json`.
- Prior version (before review fixes): escrow `0x9e851ebb3ebc62e22f3294da072ab966c3390421`, kept in `web/src/data/run-v1.json` and labeled on `/recorded`.

## Bugs found and fixed

| Bug | Fix | Commit |
|---|---|---|
| Disputes could stay open forever | `resolveDisputeAfterTimeout` after 30 days: 50/50 if proof posted, else full refund | 4153c2f |
| Expiry refund could claw back delivered work | `refundExpired` reverts once proof exists | 4153c2f |
| Provider could swap the agent without client consent | `setAgent` proposes, `approveAgent` by client; `AgentProposed` event | 4153c2f |
| Dead `NotFullyFunded` branch kept coverage below 100% | removed; all revert branches tested | 4153c2f |
| Sample explorer links went to real Arbiscan and 404'd | `HashValue` shows a "sample" chip, links only recorded values | 3138a2c |
| Landing said deployment "not supplied" | links the live escrow and the 14 recorded txs | 3138a2c |
| `/recorded` failed contrast (44 axe violations) | dim and accent tokens raised to 4.5:1+ | 3138a2c |
| Release dialog opened scrolled down on mobile | scrolls to top on open | 3138a2c |
| Lint error: raw `<a href="/">` | `next/link` | 3138a2c |

## Fixes map (REVIEW.md)

| Item | Status |
|---|---|
| M1 implied affiliation | Fixed. Eyebrow reads "Zilla OS · Built on Arbitrum · Testnet demo"; no cohort or program copy (e2e asserts it). |
| M2 placeholder explorer links 404 | Fixed. Sample values show a chip and no link; e2e checks every Arbiscan href on 16 routes. |
| M3 "deployment not supplied" | Fixed. Landing links the escrow address and `/recorded`. |
| M4 Arbiscan verification | **Done** (2026-10-28 10:34 AM MT). Source verified: [escrow](https://sepolia.arbiscan.io/address/0xc2fec2d41a795d75286d8e52192a09cd1a3c8dd2#code), [mock stablecoin](https://sepolia.arbiscan.io/address/0x34b161d6315c9874cec85d54c0ad7e8baa208eec#code). |
| M5 public demo URL | **Done**. Vercel Authentication is off for this project; the app sits behind a demo password (`/unlock`). The password is shared with reviewers by Al. |
| S1 dispute exit | Fixed in contract + tests. |
| S2 expiry claw-back | Fixed in contract + tests. |
| S3 agent consent | Fixed in contract + tests. Note: agent may still equal provider, and while an agreement is Proposed the provider can propose a new agent before the client accepts (the client still has to approve it). |
| S4 uncovered branches | Fixed. 100% branch coverage. |
| S5 contradictory wallet state | Fixed. Chip reads "Preview as [role]" and shows no address. |
| S6 internal notes in copy | Fixed. Faucet reads "Faucet coming soon". |
| S7 legal caveat only on `/recorded` | Fixed. Money-transmission line in the app footer. |
| S8 `/recorded` contrast | Fixed. 0 axe violations. |
| S9 two design systems | Partly. Both surfaces cross-link (sidebar and footer link `/recorded`); a full visual merge is deferred. |
| S10 review tools exposed | Fixed. Labeled "Demo controls · View as". |
| S11 Node version | Fixed. `engines.node` = 22.x. |
| N1 future fixture dates | Deferred (fiction; optional "Sample timeline" label). |
| N2 token allowlist | Deferred to mainnet work. |
| N3 past-due extension | Deferred (contract change after the redeploy). |
| N4 390px nav fade | Deferred. |
| N5 ERC-8004 / USDG | Mentioned in the submit packet only. |

## Arbiscan verification (done for the deployment above)

```
export ETHERSCAN_API_KEY=...   # kept outside the repo
cd contracts
forge verify-contract 0xc2fec2d41a795d75286d8e52192a09cd1a3c8dd2 src/ZillaEscrow.sol:ZillaEscrow --chain 421614 --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun --watch
forge verify-contract 0x34b161d6315c9874cec85d54c0ad7e8baa208eec src/mocks/MockStablecoin.sol:MockStablecoin --chain 421614 --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun --watch
```

## Installable app (PWA) and demo password gate

- Web app manifest (`/manifest.webmanifest`): standalone, start URL `/`, icons 192/512 plus maskable, apple-touch icon, iOS meta, theme color per scheme.
- Service worker (`/sw.js`) caches the app shell and same-origin static assets only. It never caches RPC, Arbiscan, `/api` or RSC requests, so onchain reads are always live.
- Every route except `/unlock`, the manifest, the service worker and icons redirects to `/unlock` until the demo password is entered. The cookie is an HMAC token (httpOnly, secure, SameSite=Lax, 30 days) bound to the current password; failures are rate limited.
- Verified on the deployed alias: unauthenticated `/`, `/fund`, `/recorded`, `/activity` redirect to `/unlock`; a wrong password is rejected with no cookie; the right password lands on `/fund`; Chrome reports the app installable at 390px with no manifest errors; offline relaunch shows the cached shell.
- Install: iPhone, open the link in Safari, Share, Add to Home Screen. Android or desktop Chrome, use the install icon in the address bar or menu, Install app.

## Screenshots (`docs/screenshots/e2e/`)

landing-review-fixes-1280, client-fund-done-1280, client-release-dialog-1280, provider-fund-1280, provider-proof-submitted-1280, mobile-menu-open-390, mobile-release-dialog-390, recorded-1280, recorded-live-read-1280.

## Self-grade against the 9.2 bar

**8.9 now; about 9.3 once M4 and M5 are done.** Contracts, tests, onchain record and UI clear the bar. Still missing: verified source on Arbiscan, a public demo URL, and the 90-second video.

## How to rerun

```
cd web && pnpm build && pnpm start -p 3215 -H 127.0.0.1 &
BASE=http://127.0.0.1:3215 OUT=../docs/screenshots/e2e node e2e/e2e.mjs
npx tsx e2e/chain-check.mts > ../docs/screenshots/e2e/chain-check.json
cd ../contracts && forge test && forge coverage --report summary
```
