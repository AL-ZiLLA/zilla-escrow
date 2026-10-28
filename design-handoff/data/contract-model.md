# Zilla Escrow contract model, for UI design

Source: `contracts/src/ZillaEscrow.sol` in the local build of AL-ZiLLA/zilla-escrow, read 2026-10-27 at 8:08 PM MDT. The build is in progress and may change. When the repo is public, read the file itself; it wins over this summary.

TESTNET DEMO. Not audited. Arbitrum Sepolia (chain id 421614) with a 6-decimal mock stablecoin (`mUSDC`, "Zilla Test USD (mock, no value)").

## Roles (wallet addresses)
| Role | Can do | UI home |
|---|---|---|
| Client | accept agreement, fund milestone, one-click release, refund expired milestone, open dispute, propose/approve/decline change order | Client agreement view |
| Provider (the service business) | create agreement, set agent, post proof, claim after 14-day silence, refund voluntarily, open dispute, propose/approve/decline change order | Provider view |
| Agent (Zilla OS delivery agent) | post proof of delivery only | Agent proof panel |
| Arbiter (demo: a labeled testnet address) | resolve a dispute with a split | Dispute screen |
Either the client or the provider creates the agreement; the other party accepts it. Approval of a change order must come from the party that did not propose it.

## Agreement status
`Proposed` (waiting for the other party to accept the exact scope hash) -> `Active` -> or `Cancelled` (creator withdrew before acceptance).
Fields to show: client, provider, agent, arbiter, token, `version`, `baselineHash` (signed scope, frozen at accept), `scopeHash` (current version), `scopeURI`, `acceptedAt`, milestone count, change order count.

## Milestone status
| Status | Meaning in plain words | Terminal |
|---|---|---|
| Pending | Agreed, not fully funded yet | no |
| Funded | Money is in escrow, waiting for delivery | no |
| Submitted | Proof of delivery posted, waiting for the client to release | no |
| Released | Paid to the provider | yes |
| Refunded | Returned to the client | yes |
| Disputed | Frozen until the arbiter decides | no |
| Resolved | Arbiter split paid out | yes |
Fields: `amount`, `funded`, `dueDate`, `submittedAt`, `phaseRef` (links to a Desk phase), `proofHash`, `proofURI`.
Edge: if a change order adds cost to a Submitted milestone, it goes back to Funded (top-up owed, then new proof needed).

## Change order status
`Proposed` -> `Approved` | `Declined` | `Cancelled` (proposer withdrew).
Fields: proposer, `target` (milestone index, or NEW_MILESTONE to append one), `baseVersion`, `costDelta`, `newDueDate`, `phaseRef`, `newScopeHash`, `reasonURI`.
Rules: due dates can only move later. A change order that does nothing is rejected. If the agreement version moved since it was proposed, approval fails as stale. On approval the version goes up by 1 and `scopeHash` changes; the signed baseline never changes. The client then funds any added cost.

## Time rules (constants)
- REVIEW_PERIOD = 14 days: after proof is posted, if the client does nothing, the provider may claim.
- REFUND_GRACE = 7 days: a funded milestone with no proof becomes refundable to the client 7 days after its due date.
- MAX_MILESTONES = 64 per agreement.

## Calls the UI triggers
createAgreement, acceptAgreement(scopeHash), cancelAgreement, setAgent(agent, agentIdentityId), fundMilestone (needs an ERC-20 approve first: two wallet steps), submitProof(proofHash, proofURI), release, claimAfterReview, refundExpired, refundByProvider, openDispute, resolveDispute(toProvider), proposeChangeOrder, approveChangeOrder, declineChangeOrder, cancelChangeOrder.
Reads: getAgreement, getMilestones, getChangeOrder, `escrowed(token)`.

## Events (the audit timeline)
AgreementCreated, MilestoneAdded, AgreementAccepted, AgreementCancelled, AgentSet, MilestoneFunded, ProofSubmitted, MilestoneReleased, MilestoneRefunded, DisputeOpened, DisputeResolved, ChangeOrderProposed, ChangeOrderApproved, ChangeOrderDeclined, ChangeOrderCancelled. Every row links to `https://sepolia.arbiscan.io/tx/<hash>`.

## Errors to design friendly copy for
NotAuthorized, NotParty, WrongAgreementStatus, WrongMilestoneStatus, WrongChangeOrderStatus, HashMismatch (the scope you are accepting is not the one proposed), NotFullyFunded, NothingToFund, TooEarly (review or refund window not over yet), StaleChangeOrder, NoOp, InvalidDate, InvalidAmount, TooManyMilestones, AmountExceedsEscrow, UnsupportedToken. Plus wallet-level: user rejected, wrong network, insufficient token balance, insufficient gas (test ETH), RPC unreachable.

## Mapping to the UDG Desk scope model (read-only reference)
Desk source: AL-ZiLLA/udg-desk branch `cursor/desk-overhaul-prototype` (prototype, may change), files `lib/scope/schema.ts`, `lib/prototype/types.ts`, `lib/prototype/cr-impact.ts`.
| Desk | Escrow |
|---|---|
| `ScopeRecord.signed_baseline` (version_no, accepted_by, accepted_at, planned_end_date) | `baselineHash` (hash of the signed snapshot), `acceptedAt`, version 1 |
| current `ScopeRecord.version_no` | `version`, `scopeHash` |
| `ScopePhase` + `phaseMilestone` | `Milestone` via `phaseRef` |
| `PrototypePayment` (amount_cents, due_date, status paid/open/upcoming, covers_md) | `Milestone.amount`, `dueDate`, status Released / Funded or Submitted / Pending |
| `ChangeRequest` (cost_delta_cents, affected_phase_ids, status draft/proposed/approved/declined, click-wrap acceptance) | `ChangeOrder` (costDelta, target, status, approval by the other party's wallet) |
| `approved_schedule_impact` (previous/new planned end, timeline_delta_days) | `ChangeOrderApproved.previousDueDate` / `newDueDate` |
| deliverables + acceptance_criteria | items inside the proof-of-delivery pack the agent hashes |
