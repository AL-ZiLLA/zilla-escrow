# Self-grading scorecard

Graded 2026-10-27 (updated after the Arbitrum Sepolia run) against the rubric below. Each criterion is scored 0 to 10, and the total is the weighted average. Target: code at least 9.2 and design at least 9.2. This is a self-assessment by the build agent, not an outside review or an audit.

## Code rubric

| # | Criterion | Weight | What a 10 looks like | Score | Evidence and deductions |
| --- | --- | --- | --- | --- | --- |
| C1 | Correctness of the money flow | 25% | Fund, proof, release, change order, refund and dispute paths behave exactly as specified, with no stuck funds | 9.5 | 47/47 tests pass. Invariants hold over 8,192 random calls: contract balance equals escrowed equals the sum of funded, and client plus provider plus escrow is conserved. |
| C2 | Security posture | 20% | Reentrancy guarded, strict access control, checks-effects-interactions, hostile tokens handled, no admin keys | 9.2 | `nonReentrant` on every payout, plus a malicious-token reentrancy suite. Fee-on-transfer tokens are rejected, there is no owner, and stale change orders are blocked. Deduction: no external audit or static analyzer run yet. |
| C3 | Test depth | 15% | Unit, fuzz and invariant tests, with high line and branch coverage | 9.3 | 100% lines, 97.9% statements, 88.6% branches, 100% functions. Fuzz runs 1,024 times per property. Deduction: 8 branches are not yet covered. |
| C4 | Type safety and build hygiene | 15% | Strict TypeScript, clean lint, clean production build | 9.5 | `tsc` strict, ESLint and `next build` are all clean, and every page is static. ABI types are generated `as const` from the compiled contract. |
| C5 | Reproducibility | 15% | One command regenerates every number shown | 9.5 | `pnpm demo:run` writes run.json, and `export-tests.mjs` writes tests.json. The page renders only those files. The full 14-transaction run is recorded on Arbitrum Sepolia, and the in-page check reads the deployed contract over the public RPC. Deduction: contract source is not yet verified on Arbiscan. |
| C6 | Hygiene and docs | 10% | No secrets, clear README, honest status | 9.4 | Keys are kept outside the repo, `.gitignore` covers env files, keys and zips, and a scan found no secrets. The README states that this is a testnet demo, not audited, with legal review before mainnet. |
| | **Weighted total** | | | **9.40** | |

## Design rubric

| # | Criterion | Weight | What a 10 looks like | Score | Evidence and deductions |
| --- | --- | --- | --- | --- | --- |
| D1 | Brand fidelity | 20% | Matches zillalabs.ai: ink and bone with a red accent, Anton headlines, square thin-bordered panels, official logo untouched | 9.4 | Uses the official SVG mark as is, the brand palette tokens, Anton plus Geist, and square 1px panels with no heavy shadows. |
| D2 | Flow clarity | 20% | A first-time viewer understands who does what at each step | 9.3 | Six-step stepper with the acting role on each step, a live agreement board beside it, and a before-and-after delta panel for the change order. |
| D3 | Information hierarchy | 15% | Clear type scale and scannable numbers and hashes | 9.2 | Display headline, then section titles, then mono eyebrows. Amounts are large and hashes are shortened with full values behind links. |
| D4 | Trust and honesty | 15% | Testnet status always visible, nothing overstated, all data fictional and labeled | 9.6 | Sticky testnet badge, "Demo. Not audited." in the hero, "(fictional)" on every party, and an "Arbitrum Sepolia testnet · Not audited" header badge. Every transaction and contract links to Arbiscan. No metrics are invented. |
| D5 | Responsive | 15% | Works from 390px to wide desktop with no overflow | 9.1 | Checked at 1440 and 390 wide. A mobile overflow in the stepper grid was found and fixed. Deduction: the mobile badge shortens to "Testnet" only. |
| D6 | Accessibility | 15% | WCAG 2.2 AA: focus, keyboard, aria-live, reduced motion, 44px targets | 9.2 | Skip link, visible red focus rings, `aria-current` on steps, `aria-live` on the stage and hash check, a reduced-motion fallback, and 44px buttons. Status is shown with text plus color. Deduction: no automated axe pass yet. |
| | **Weighted total** | | | **9.31** | |

## Screenshots

Under `docs/screenshots/`: `desktop-hero.png`, `desktop-full.png`, `desktop-section-1..3.png`, `mobile-hero.png`, `mobile-walkthrough.png`, `mobile-board.png`, `mobile-audit.png`. They were captured from a local production build (`next start`) with a fresh headless profile and reduced motion turned on.

## Iteration log

1. First pass used system fonts, rounded cards, a placeholder "Z" mark and a long network badge. Moved to the official logo, Anton and Geist, and square panels to match the brand.
2. On mobile the walkthrough card overflowed the viewport because grid items had an auto minimum width. Fixed with `grid-cols-1` and `min-w-0`.
3. The mobile header wrapped the wordmark onto two lines. Fixed with no-wrap and a shorter badge on small screens.
4. The build failed on BigInt literals (ES2017 target), on JSON-inferred types that were too narrow, and on a set-state-in-effect lint error. Fixed with an ES2022 target, explicit `Run` types and `useMemo`.
5. Recorded the run on Arbitrum Sepolia, replaced the "Local rehearsal" label with "Arbitrum Sepolia testnet", linked each event to its Arbiscan event log, and retook the screenshots.
