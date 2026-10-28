/**
 * Synthetic demo data. Every business, person, amount and deliverable here is fictional.
 * The shape mirrors a UDG Desk scope: phases with deliverables and acceptance criteria,
 * a payment schedule tied to phases, a signed baseline, and change requests with an
 * approved schedule impact. Amounts are in a mock test token with no value.
 */

export type Phase = {
  ref: string;
  name: string;
  summary: string;
  deliverables: string[];
  acceptance: string[];
  amount: number;
  durationDays: number;
};

export type ChangeRequest = {
  id: string;
  target: string;
  title: string;
  reason: string;
  costDelta: number;
  scheduleImpactDays: number;
};

export type ScopeDoc = {
  schema: "zilla-escrow/scope@1";
  version: number;
  project: string;
  client: string;
  provider: string;
  currency: string;
  phases: Phase[];
  changeRequests: ChangeRequest[];
  terms: { reviewPeriodDays: number; refundGraceDays: number; changePolicy: string };
};

const phases: Phase[] = [
  {
    ref: "P1",
    name: "Discovery and site map",
    summary: "Interview the owners, audit the current site and agree on what the new one must do.",
    deliverables: ["Stakeholder interview notes", "Content inventory", "Site map and page list"],
    acceptance: ["Client signs off the site map", "Every current page is mapped or retired"],
    amount: 2400,
    durationDays: 14,
  },
  {
    ref: "P2",
    name: "Design and online ordering",
    summary: "Visual design, menu pages and a pickup ordering flow.",
    deliverables: ["Design system", "Menu and location pages", "Pickup ordering flow"],
    acceptance: ["Designs approved in review", "Test order completes end to end"],
    amount: 4800,
    durationDays: 21,
  },
  {
    ref: "P3",
    name: "Build, launch and handover",
    summary: "Production build, launch checklist and a handover session.",
    deliverables: ["Production site", "Launch checklist", "Recorded handover session"],
    acceptance: ["Launch checklist complete", "Owner can edit the menu without help"],
    amount: 3600,
    durationDays: 21,
  },
];

export const changeRequest: ChangeRequest = {
  id: "CR-1",
  target: "P2",
  title: "Add gift card checkout",
  reason: "The owners want to sell gift cards for the holidays. Adds a checkout path and one week.",
  costDelta: 900,
  scheduleImpactDays: 7,
};

const base = {
  schema: "zilla-escrow/scope@1" as const,
  project: "Website rebuild with online ordering",
  client: "Harbor Lane Bakery (fictional)",
  provider: "Northwind Studio (fictional)",
  currency: "mUSDC, a mock test token with no value",
  terms: {
    reviewPeriodDays: 14,
    refundGraceDays: 7,
    changePolicy:
      "Changes are proposed by either party and take effect only when the other party approves on chain.",
  },
};

export const scopeV1: ScopeDoc = { ...base, version: 1, phases, changeRequests: [] };

export const scopeV2: ScopeDoc = {
  ...base,
  version: 2,
  phases: phases.map((p) =>
    p.ref === changeRequest.target
      ? {
          ...p,
          amount: p.amount + changeRequest.costDelta,
          durationDays: p.durationDays + changeRequest.scheduleImpactDays,
          deliverables: [...p.deliverables, "Gift card checkout"],
        }
      : p,
  ),
  changeRequests: [changeRequest],
};

export type ProofPack = {
  schema: "zilla-escrow/proof@1";
  phase: string;
  postedBy: string;
  artifacts: { name: string; kind: string }[];
  checks: { criterion: string; result: "met" }[];
  note: string;
};

export const proofP1: ProofPack = {
  schema: "zilla-escrow/proof@1",
  phase: "P1",
  postedBy: "Northwind delivery agent",
  artifacts: [
    { name: "interview-notes.md", kind: "notes" },
    { name: "content-inventory.csv", kind: "sheet" },
    { name: "site-map-v1.pdf", kind: "document" },
  ],
  checks: [
    { criterion: "Client signs off the site map", result: "met" },
    { criterion: "Every current page is mapped or retired", result: "met" },
  ],
  note: "Site map approved in the review call. Files attached to the proof pack.",
};

export const proofP2: ProofPack = {
  schema: "zilla-escrow/proof@1",
  phase: "P2",
  postedBy: "Northwind delivery agent",
  artifacts: [
    { name: "design-system.fig", kind: "design" },
    { name: "menu-pages-preview.url", kind: "link" },
    { name: "test-order-recording.mp4", kind: "video" },
    { name: "gift-card-checkout-test.mp4", kind: "video" },
  ],
  checks: [
    { criterion: "Designs approved in review", result: "met" },
    { criterion: "Test order completes end to end", result: "met" },
  ],
  note: "Includes the gift card checkout added by CR-1.",
};

/** Mock token has 6 decimals, like common stablecoins. */
export const units = (dollars: number) => BigInt(Math.round(dollars * 1e6));
