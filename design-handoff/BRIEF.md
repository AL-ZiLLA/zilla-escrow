# Design brief: Zilla Escrow (testnet demo)

Prepared 2026-10-27 for an outside designer. Repo: https://github.com/AL-ZiLLA/zilla-escrow (public; being built now, see "Repo status").

## 1. What it is
Zilla Escrow is milestone escrow for service businesses, built into Zilla OS, the agentic operating system for any business. A client and a service provider agree a signed scope. Each milestone has an amount, a due date and a status. The client funds a milestone into escrow in a stablecoin. A Zilla OS agent posts proof of delivery. The client releases the money in one click. A change order adds funds and moves dates only when both sides approve. A dispute path and refund rules cover the rest. Every step is an onchain event, so both sides get a record of what was agreed, delivered and paid that nobody can quietly edit.

Chain: Arbitrum Sepolia testnet (chain id 421614). Token: a mock stablecoin `mUSDC` with no value (real test USDC or USDG may replace it). Contract: Solidity, non-custodial (no admin withdraw, no upgrade). Not audited.

Escrow is the onchain payment layer for the same scope / phase / change-request model used by UDG Desk, the client portal Unicorn Development Group runs. Read `data/contract-model.md` for the exact mapping.

## 2. Audiences (design for all three)
1. **Arbitrum Mentorship judges** (Cohort 2 with Robinhood Chain). They want a working prototype on Arbitrum, clear stablecoin payments, and AI agents doing real work. They will click through the demo once, fast.
2. **Demo day investors.** They need the story in 10 seconds: "the client sees exactly what they pay for, and money moves only when work is proven."
3. **Real service-business clients** (owners of small businesses buying web, design, marketing or ops work). Many have never used a wallet. Plain words first, chain details one click deeper.

## 3. Repo status at handoff (2026-10-27, 8:08 PM MDT)
- The GitHub repo was **not published yet**. A build is in progress on the build box.
- `contracts/`: Foundry project with `ZillaEscrow.sol`, a mock stablecoin, a deploy script (testnet only) and tests (unit, fuzz, invariant, reentrancy).
- `web/`: Next.js App Router + TypeScript + Tailwind v4 + viem, still the default starter page. `web/src/lib/abi.ts` holds the generated ABI.
- **No current screens exist.** Every screen below is planned. Design from this brief; check the repo for newer work when it is public.
- Not deployed yet. Explorer links in the sample data are placeholders.

## 4. Brand and visual system (match zillalabs.ai)
See `screens/reference--*.png` and `brand/`.
- **Ink** `#0A0A0A` page, panels `#0F0F11` / `#141416`, lines `#232327` / `#2A2A2E` (1px), text ivory `#F5F3EE`, secondary `#B8B5AE`, dim `#9A9894` / `#8A8883`.
- **Accent red** `#C8102E`: primary buttons, the "approval gate" motif, focus rings, the red left bar on eyebrows. Red is for action and the gate, not for errors.
- **Green** `#39D98A` (tint `#7FF0B5`): released, verified, healthy. **Cyan** `#38BDF8`: in progress / pending tx. **Amber** (pick one, e.g. `#D9A85A`): waiting on someone, review window, change order proposed. **Error**: use a distinct soft red-orange (e.g. `#E5484D`) plus an icon and text, never color alone, so errors do not look like the brand accent.
- **Type**: Anton uppercase for big headlines only (as on the site). Geist Sans (or system UI) for body. A monospace (ui-monospace) for eyebrows, ids, hashes, amounts and status chips, uppercase with wide letter spacing (about .1 to .14em).
- **Shapes**: thin 1px borders, mostly square corners (small radius at most, 4px on chips). No heavy shadows. Subtle grid background and soft glows are fine, as on the site.
- **Logo**: the flat Zilla mark (red square outline, red bolt, two white bars that stay white). Header, nav and icons only. Do not redraw or recolor it; do not use it as a hero image. Exact paths in `brand/LOGO-SPEC.md`.
- **Consistency with UDG Desk**: same information order (overview header, timeline, changes, payments), same status-chip grammar (mono, uppercase, 1px border in the status color, light tint), same "what you signed vs what it is now" pattern, same click-wrap approval feel. Desk wears UDG gold; Escrow wears Zilla red. A user who knows one should find their way in the other.
- Motion: calm. Light moving along a line into the "gate" when funds move is on brand (the site does this). Respect `prefers-reduced-motion`.

## 5. Global elements (every screen)
- **Testnet badge**, always visible in the header: "TESTNET · Arbitrum Sepolia · test tokens, no value". Do not let it be hidden on mobile. Second line in footer: "Demo. Not audited. Do not send real funds."
- Header: flat logo + "Zilla Escrow", connected wallet chip (short address, role tag CLIENT / PROVIDER / AGENT / ARBITER, network), and the testnet badge.
- Amounts: always token + 2 decimals, e.g. `3,500.00 mUSDC`. Never show base units. Never show a dollar sign for test tokens.
- Hashes and addresses: shortened (`0x4f3a…9c21`), copy button, full value on hover/focus, explorer link icon.
- Dates: absolute date plus relative ("Dec 11, 2026 · in 6 days").

## 6. Screens and flows
For each screen: purpose, must-show data, actions, states. Sample data for all of them is in `data/sample-agreement.json` and `data/sample-states.json` (fictional: Fernwood Design Studio is the provider, Saltmarsh Coffee Roasters is the client).

### S1. Landing / explainer
Purpose: tell judges, investors and clients what this is in one screen, then start the demo.
Must show: one-line value ("Milestone escrow for service work. Money moves when the work is proven."), a 4-step strip (Agree scope → Fund milestone → Agent proves delivery → Client releases), a small live-looking diagram of a milestone moving through the gate, testnet badge, "Open the demo agreement" and "Connect wallet" buttons, a link to the contract on the explorer and to the GitHub repo, "Part of Zilla OS" link to zillalabs.ai. A short "Why onchain" row: tamper-proof record, funds visible in escrow, no one can withdraw except by the rules.
Do not show: user counts, volume, savings, or any metric. There are none.

### S2. Connect wallet
Must show: wallet options (injected / WalletConnect style), what network is needed, a plain explanation for first-timers ("A wallet is how you sign and pay. This demo uses free test tokens."), a link to get test ETH and test mUSDC.
States: not installed, connecting, connected, **wrong network** (one-click "Switch to Arbitrum Sepolia"), rejected. After connect, detect the role per agreement (client / provider / agent / arbiter / viewer) and show it.

### S3. Create agreement from a scope (provider side, also usable by client)
Purpose: turn a Desk-style signed scope into an onchain agreement.
Must show: scope title, prepared for / by, version, list of phases with the milestone each becomes (label, amount, due date, phase ref), total, the scope hash that will be recorded and what it means ("a fingerprint of this exact document"), client wallet, agent wallet (optional), arbiter (labeled demo), token. Review step before signing.
Actions: import scope (paste JSON or pick the sample), edit amounts and dates, set addresses, Create (one transaction).
Validation: due dates in the future, amounts above zero, max 64 milestones, client, provider, agent and arbiter must be different.
Then: **Proposed** state screen: "Waiting for {client} to accept this exact scope." with share link; creator can Cancel before acceptance.
Counterparty acceptance: shows the same scope, the hash, a checkbox "I accept this scope, these amounts and dates", Accept. Mismatch error if the scope changed (HashMismatch).

### S4. Client agreement view (the main screen)
Purpose: the client sees exactly what they get, where the work stands, and what each payment covers.
Header block: agreement title, provider, status chip, version ("v2 · 1 change approved"), signed baseline vs current (end date then and now, total then and now), testnet badge.
Money summary (4 cells): Contract total, In escrow now, Released to provider, Still to fund. From sample: 11,800.00 / 8,000.00 / 2,000.00 / 1,800.00 mUSDC.
Next action card: the one thing this user should do now (e.g. "P2 Site design is delivered. Review the proof and release 3,500.00 mUSDC.").
Milestone list: for each, label + phase code, amount, funded amount, due date, status chip, what it covers (deliverables), proof link if any, the action available to *this* role, and a mini progress track (Pending → Funded → Submitted → Released).
Timeline strip: milestones on a date axis, signed baseline dashed, current solid, so date moves from change orders are visible (same idea as Desk's Gantt).
Tabs or sections: Overview · Milestones · Changes · Activity (audit) · Scope.

### S5. Fund a milestone
Must show: milestone, what it covers, amount owed now (full or top-up after a change order), wallet balance, "Funds stay in escrow until you release them. Nobody else can move them except by the rules below." Short rules: release, 14-day auto-claim, 7-day refund after due date, dispute.
Flow: two wallet steps shown as a stepper: 1 Allow escrow to use mUSDC (approve), 2 Fund. Each step: waiting for wallet → pending (tx hash link) → confirmed. Insufficient balance state with "Get test mUSDC".

### S6. Agent proof-of-delivery panel
Purpose: show that a Zilla OS agent assembled the evidence, and let the client inspect it.
Must show: "Submitted by Zilla OS delivery agent" with agent address, time, the deliverables checked off against the scope's acceptance criteria, the files/links in the pack, the proof hash and URI, "verify" affordance (hash of the pack matches the onchain proof hash), review window countdown ("Release, dispute, or it auto-releases to the provider after 14 days: Dec 24, 2026").
Provider/agent side: compose the pack (pick deliverables, attach links), preview hash, Submit proof. Resubmit replaces the proof (show history of earlier proofs from events).

### S7. One-click release confirmation
Must show: milestone, amount, recipient (provider name + address), what it covers, the proof being accepted, "This is final. Released funds cannot be pulled back." One primary button "Release 3,500.00 mUSDC". Then success state with tx link and the updated money summary. Keep it one click after the confirmation; no extra forms.

### S8. Change order: request and approval
Request (either side): pick target (an existing open milestone, or add a new milestone), cost to add, new due date (only later, never earlier), reason, what changes in scope. Live **impact panel**: total before → after, this milestone before → after, end date before → after with +N days, version vN → vN+1, "the signed baseline stays as it was."
Approval (the other side only): the same impact panel, the proposer, reason, click-wrap checkbox "I approve this change to scope, price and timeline", Approve / Decline. Proposer can Withdraw while it is pending.
After approval: if cost was added, prompt the client to fund the top-up; if the milestone was Submitted it goes back to Funded and needs new proof (explain this).
States: proposed (amber), approved (green), declined, withdrawn, **stale** ("the agreement changed since this was proposed").
Sample: CO-1 approved (adds P4 Online ordering, +1,800.00, end date +14 days), CO-2 proposed (+500.00 on P3, due date +7 days).

### S9. Dispute and refund
Dispute: either party can freeze a Funded or Submitted milestone. Must show: who opened it, when, amount held, the arbiter (labeled "Demo arbiter, testnet"), what happens next, and that the arbiter can only split the held amount between the two parties. Arbiter screen: slider/inputs for the split that must add up to the held amount, confirm.
Refund paths: client "Take back funds" when nothing was delivered by due date + 7 days (show countdown before it unlocks); provider "Return funds to client" voluntarily; provider "Claim payment" when the client has not responded 14 days after proof.
Copy must be calm and neutral. Do not promise legal outcomes.

### S10. Audit timeline
Every event in order: icon, plain sentence ("Client funded P2 Site design: 3,500.00 mUSDC"), actor role + short address, time, tx hash with explorer link, and for scope events the hash. Filters: All / Money / Proof / Changes / Disputes. Export (CSV/JSON) is a nice-to-have. Header line: "Rebuilt from onchain events. Nobody can edit this list."

### S11. System states (design all of them)
- Empty: no wallet; connected with no agreements ("No agreements yet. Open the demo agreement or create one.").
- Loading: skeletons that match the final layout (no layout jump).
- Pending tx: inline on the row and as a toast with explorer link; the UI stays usable; show "Waiting for Arbitrum Sepolia" and then confirmed.
- Errors: wallet rejected, wrong network, insufficient token, insufficient test ETH for gas, RPC unreachable, contract errors with friendly text (list in `data/contract-model.md`). Each says what happened, whether money moved (usually "Nothing was sent"), and what to do.
- Read-only viewer (wallet not a party): everything visible, no actions, a note why.

### S12. Mobile (390px wide)
All screens must work at 390px. Milestones become stacked cards, the money summary becomes a 2x2 grid, the timeline scrolls horizontally or switches to a list, the primary action sticks to the bottom, the testnet badge stays visible, hashes truncate with copy. Touch targets 44px minimum.

## 7. Statuses and chip grammar
Milestone: PENDING (dim), FUNDED (cyan), SUBMITTED (amber, "needs your review" for client), RELEASED (green), REFUNDED (dim with return icon), DISPUTED (error color + lock icon), RESOLVED (dim, shows split).
Agreement: PROPOSED (amber), ACTIVE (green), CANCELLED (dim).
Change order: PROPOSED (amber), APPROVED (green), DECLINED (dim), WITHDRAWN (dim), STALE (error).
Tx: WAITING FOR WALLET, PENDING, CONFIRMED, FAILED.
Every chip has text, not color alone.

## 8. Trust and transparency cues (non-negotiable)
- The client always sees: what each payment covers (deliverables), where the work stands, how much is in escrow now, what has been released, what is still owed.
- Signed baseline vs current version is always one glance away.
- Every money movement links to the explorer.
- Rules are visible near every money action (14-day review, 7-day refund grace, dispute).
- Agent work is labeled as agent work, with the agent address.
- Testnet and "not audited" are always visible. No fake security seals, no "insured", no "guaranteed".

## 9. Accessibility
WCAG 2.2 AA. Contrast 4.5:1 for text (check dim grays on ink), focus rings visible (red ring with offset), full keyboard path through fund / release / approve, status never by color alone, aria-live for tx status updates, reduced-motion fallback for every animation, readable hashes for screen readers (label "transaction hash, starts 0x4f3a"), form errors tied to fields, touch targets 44px.

## 10. Copy rules
Plain words. No em dashes. No invented metrics or numbers (no users, volume, savings, uptime claims). Use only these product names: Zilla Labs, Zilla OS, Zilla Escrow, UDG Desk. Do not name or describe any other Zilla product. Never name any real client; use the fictional names in the sample data. Do not say "guaranteed", "insured" or "bank-grade". Testnet copy must make clear the tokens have no value.

## 11. What we need back
Pick one of these, in this order of preference:
1. **React + Tailwind components** for Next.js App Router (TypeScript, Tailwind v4, no other UI library required), typed against the sample JSON shapes, one file per component, plus a page per screen wired to the sample data. Drop-in target: `web/src/components/escrow/` and `web/src/app/`. Include a `tokens.css` (CSS variables for the colors and type above).
2. **Figma-style spec** in markdown: per screen, layout grid, components, spacing, type sizes, colors by token, every state, desktop 1440 and mobile 390.
Either way also include: a component inventory, the status chip set, the tx stepper, the impact panel, the audit row, empty/loading/error/pending variants, mobile layouts, and a short rationale per screen (why this order, what the client notices first).
No new dependencies that cost money. No external analytics, no fonts other than those named.

## 12. Files in this package
- `BRIEF.md`: this file.
- `prompt.md`: paste-in prompt for the design chat.
- `data/sample-agreement.json`: fictional Desk-shaped scope plus escrow state (agreement, milestones, change orders, audit timeline, totals).
- `data/sample-states.json`: empty, loading, pending, error, dispute, refund and stale fixtures.
- `data/contract-model.md`: roles, statuses, rules, calls, events, errors, and the Desk mapping.
- `screens/`: brand references from zillalabs.ai (no escrow screens exist yet) and a README.
- `brand/`: the flat Zilla logo (SVG, PNG) and its spec.
