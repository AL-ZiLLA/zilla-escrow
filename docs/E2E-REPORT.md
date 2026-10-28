# Zilla Escrow: E2E test report (2026-10-28)

Branch `ui-v2-integration`, PR #1 (not merged). Testnet only: Arbitrum Sepolia (chain 421614). Wallet and transaction actions in the escrow app are UI simulations; the real testnet record is at `/recorded`.

## Result: PASS

| Check | Result |
|---|---|
| Browser e2e (`web/e2e/e2e.mjs`, Chrome, 16 escrow routes + `/recorded`, dark/light, 1280 and 390) | **232/232 passed** (`docs/screenshots/e2e/results.json`) |
| axe WCAG 2.1 AA, every route, both themes, both widths, local build | 0 violations (`axe.json`) |
| axe WCAG 2.1 AA on the DEPLOYED branch alias (`web/e2e/axe-deployed.mjs`): 17 routes + `/unlock`, dark/light, 1280 and 390, axe-core 4.14.0 | **72 page runs, 0 violations** (`docs/screenshots/axe-deployed/axe-deployed.json`). Served CSS has `--color-dim: #8a8884` and `--color-zilla-soft: #e5435c` (fresh build, no build cache). |
| Onchain check (`web/e2e/chain-check.mts`): every recorded tx, event, balance and state read back from Arbitrum Sepolia | **93/93** (`chain-check.json`) |
| Every Arbiscan link in the UI points to a recorded address or tx | pass (`recorded-links.json`) |
| Foundry: 67 tests (unit, review-fix, regrade R3/R6, fuzz, invariant) | 67/67 pass |
| Coverage of `src/ZillaEscrow.sol` | 100% lines (296/296), statements (428/428), branches (82/82), functions (31/31) |
| Deployed bytecode vs local `forge build` (`cast code`) | v3 is byte-identical to the verified source at commit e446c32 (escrow and token). Later commits add natspec comments only: the executable code is identical and only the trailing metadata hash differs (rechecked after the natspec change). |
| Arbiscan source verification (v3) | escrow and token verified (solc 0.8.24, 200 runs, cancun) |
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | green |
| Demo password gate + PWA (`web/e2e/gate-pwa.mjs`) on the deployed branch alias | **28/28** (`docs/screenshots/pwa/gate-pwa-results.json`; includes `/favicon.ico` reachable without the gate, added in 695107d) |
| Vercel preview | branch alias https://zilla-escrow-git-ui-v2-integration-al-zillas-projects.vercel.app (demo password gate; Vercel Authentication off for this project) |

## Deployment (current)

v3, deployed 2026-10-28 after the regrade fixes (R3, R6), contract source at commit e446c32:

- Escrow: [`0x0f5d52bbabf08ee90dd349e11fcbc3cae6fb3eed`](https://sepolia.arbiscan.io/address/0x0f5d52bbabf08ee90dd349e11fcbc3cae6fb3eed#code) (verified)
- Mock stablecoin: [`0x11aa41c1d312931852dad937718635f7949a4a82`](https://sepolia.arbiscan.io/address/0x11aa41c1d312931852dad937718635f7949a4a82#code) (verified)
- Deploy block 323738269; 14 recorded transactions in `web/src/data/run.json`.

Prior versions (superseded, labeled on `/recorded` and in the README):

- v2 (after the first review fixes): escrow [`0xc2fec2d41a795d75286d8e52192a09cd1a3c8dd2`](https://sepolia.arbiscan.io/address/0xc2fec2d41a795d75286d8e52192a09cd1a3c8dd2#code), token `0x34b161d6315c9874cec85d54c0ad7e8baa208eec`, both verified; kept in `web/src/data/run-v2.json`.
- v1 (before the review fixes): escrow `0x9e851ebb3ebc62e22f3294da072ab966c3390421`, kept in `web/src/data/run-v1.json`.

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
| Preview served stale CSS from the Vercel build cache (old `--color-dim`) | `VERCEL_FORCE_NO_BUILD_CACHE=1` on Preview only; build log shows the cache step skipped; deployed axe 0 violations | 79da274 build |
| R3: a day-1 dispute blocked proof and refunded in full at day 30 if the arbiter was silent | `submitProof` allowed while Disputed (stays Disputed); no-proof timeout refund also waits for due date + 7 days | e446c32 |
| R6: provider could swap the agent right before the client accepted | `acceptAgreement(id, scopeHash, expectedAgent)` reverts `AgentMismatch` on a swap | e446c32 |
| Regrade 2 residual: with an absent arbiter, junk proof posted during a dispute turns a no-proof refund into the 50/50 timeout split | Documented, no contract change: the contract checks only that a proof hash exists; judging quality is the arbiter's job. Natspec on `resolveDisputeAfterTimeout`, README contract mechanics | docs |
| Landing source link pinned to a moving branch | pinned to commit e446c32 | 1217dd6 |
| Stale "Placeholder. Not deployed yet" fixture note | reworded to point at the recorded run | 1217dd6 |

## Fixes map (REVIEW.md)

| Item | Status |
|---|---|
| M1 implied affiliation | Fixed. Eyebrow reads "Zilla OS · Built on Arbitrum · Testnet demo"; no cohort or program copy (e2e asserts it). |
| M2 placeholder explorer links 404 | Fixed. Sample values show a chip and no link; e2e checks every Arbiscan href on 16 routes. |
| M3 "deployment not supplied" | Fixed. Landing links the escrow address and `/recorded`. |
| M4 Arbiscan verification | **Done**. v3 source verified: [escrow](https://sepolia.arbiscan.io/address/0x0f5d52bbabf08ee90dd349e11fcbc3cae6fb3eed#code), [mock stablecoin](https://sepolia.arbiscan.io/address/0x11aa41c1d312931852dad937718635f7949a4a82#code). v2 also verified (10:34 AM MT). |
| M5 public demo URL | **Done**. Vercel Authentication is off for this project; the app sits behind a demo password (`/unlock`). The password is shared with reviewers by Al. |
| S1 dispute exit | Fixed in contract + tests. |
| S2 expiry claw-back | Fixed in contract + tests. |
| S3 agent consent | Fixed in contract + tests. Since v3 the client also names the agent at acceptance, so a pre-acceptance swap makes acceptance revert (R6). Agent may still equal provider. |
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

## Arbiscan verification (done for v3 above)

```
export ETHERSCAN_API_KEY=...   # kept outside the repo
cd contracts
forge verify-contract 0x0f5d52bbabf08ee90dd349e11fcbc3cae6fb3eed src/ZillaEscrow.sol:ZillaEscrow --chain 421614 --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun --watch
forge verify-contract 0x11aa41c1d312931852dad937718635f7949a4a82 src/mocks/MockStablecoin.sol:MockStablecoin --chain 421614 --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun --watch
```

## Installable app (PWA) and demo password gate

- Web app manifest (`/manifest.webmanifest`): standalone, start URL `/`, icons 192/512 plus maskable, apple-touch icon, iOS meta, theme color per scheme.
- Service worker (`/sw.js`) caches the app shell and same-origin static assets only. It never caches RPC, Arbiscan, `/api` or RSC requests, so onchain reads are always live.
- Every route except `/unlock`, the manifest, the service worker and icons redirects to `/unlock` until the demo password is entered. The cookie is an HMAC token (httpOnly, secure, SameSite=Lax, 30 days) bound to the current password. After unlock, `next` must be a same-origin path (one leading `/`, no `//`, no backslash, whitespace or control characters, no scheme); anything else goes to `/`.
- Brute-force throttle on `/api/unlock`, **best-effort, not a hard limit**. This Vercel project has no shared durable store, so it combines two layers: (1) an in-memory counter per client IP, which lives in one warm function instance only, so attempts that land on other instances are counted separately; (2) a signed attempt cookie (HMAC with the gate secret, path `/api/unlock`), which a browser cannot reset or forge but a script can drop. After 5 failures in 15 minutes the client is locked out for 15 minutes, doubling on each repeat lockout up to 4 hours; while locked, the password is not checked at all. Each failure waits 0.5 s, 1 s, 2 s, then 4 s before answering. Password compare is constant-time. The real protection is the long random password; a Vercel Firewall rate-limit rule or a KV counter would make this a hard limit (Al's call).
- Live check on the deployed branch alias (`web/e2e/gate-attack.mjs`, 18/18, results in `docs/screenshots/pwa/gate-attack.json`):
  - 12 hostile `next` values with the correct password (tab, CR, LF, space, `//`, `///`, `/\`, `\\`, `https:`, `javascript:`, `/..//`) all redirect to `/` on the same origin. A normal `next=/fund?x=1` still works.
  - Browser-style (attempt cookie kept): tries 1 to 4 answer "wrong" after 0.5, 1, 2 and 4 s; try 5 and later answer "limit, wait 15 minutes"; the correct password is then refused with no gate cookie.
  - Script-style (no cookie, sequential): 3 of 6 refused as "limit". Requests landed on more than one function instance, so only some were counted together.
  - Parallel burst of 10 with no cookie: all 10 answered "wrong", none unlocked. This is the honest limit of a per-instance store: a script that drops cookies and spreads requests is slowed, not stopped.
- Resolved outside code (Al, Vercel dashboard, 2026-10-28 12:13 PM MT): the seven old public preview deployments were deleted: pre-gate 80ca363, 3138a2c, c5acfa7 (public without the gate because Vercel Authentication is off for the project) and old-gate nw3v13lpi, fklpww45s, j0kaiyugl, qohq4fov3 (gate without the redirect and lockout fixes), that is everything older than kak10a7dk. Rechecked: all seven hosts return 404 DEPLOYMENT_NOT_FOUND; the branch alias and kak10a7dk return 307 to `/unlock`. No project settings changed.
- Verified on the deployed alias: unauthenticated `/`, `/fund`, `/recorded`, `/activity` redirect to `/unlock`; a wrong password is rejected with no cookie; the right password lands on `/fund`; Chrome reports the app installable at 390px with no manifest errors; offline relaunch shows the cached shell.
- Install: iPhone, open the link in Safari, Share, Add to Home Screen. Android or desktop Chrome, use the install icon in the address bar or menu, Install app.

## Screenshots (`docs/screenshots/e2e/`)

landing-review-fixes-1280, client-fund-done-1280, client-release-dialog-1280, provider-fund-1280, provider-proof-submitted-1280, mobile-menu-open-390, mobile-release-dialog-390, recorded-1280, recorded-live-read-1280.

## Self-grade against the 9.2 bar

**GroKy regrade 2: code 9.4 and design 9.3, both PASS.** The password gate scored 7.8 before 4597f9d (open redirect closed) and ff6d847 (best-effort lockout). GroKy regrade 3 scored the gate 9.3 PASS; the seven old public preview deployments it depended on were removed on 2026-10-28. Still missing: the 90-second video.

## How to rerun

```
cd web && pnpm build && pnpm start -p 3215 -H 127.0.0.1 &
BASE=http://127.0.0.1:3215 OUT=../docs/screenshots/e2e node e2e/e2e.mjs
npx tsx e2e/chain-check.mts > ../docs/screenshots/e2e/chain-check.json
GATE_ENV=<demo env file> BASE=<preview URL> node e2e/axe-deployed.mjs
GATE_ENV=<demo env file> BASE=<preview URL> node e2e/gate-attack.mjs   # run last: locks your IP out of /api/unlock for 15+ min
cd ../contracts && forge test && forge coverage --report summary
```
