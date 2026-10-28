import { hexToString } from "viem";
import runData from "@/data/run.json";

export type RoleKey = "deployer" | "client" | "provider" | "agent" | "arbiter";
export type RunEvent = { name: string; args: Record<string, string | number> };
export type RunStep = {
  key: string;
  title: string;
  role: RoleKey;
  txHash: string;
  block: number;
  timestamp: number;
  gasUsed: string;
  events: RunEvent[];
};
export type Run = {
  generatedAt: string;
  network: { key: string; name: string; chainId: number; explorer: string | null };
  contracts: { escrow: string; token: string; deployBlock: number };
  roles: Record<RoleKey, string>;
  agreementId: string;
  hashes: { scopeV1: string; scopeV2: string; proofP1: string; proofP2: string };
  steps: RunStep[];
  final: {
    agreement: Record<string, string | number>;
    milestones: Record<string, string | number>[];
    escrowed: string;
  };
};

/** The recorded demo run, written by scripts/run-demo.ts. */
export const run = runData as unknown as Run;

export const ROLE_LABEL: Record<RoleKey, string> = {
  deployer: "Deployer",
  client: "Client",
  provider: "Provider",
  agent: "Delivery agent",
  arbiter: "Arbiter",
};

export const MILESTONE_STATUS = [
  "Pending",
  "Funded",
  "Submitted",
  "Released",
  "Refunded",
  "Disputed",
  "Resolved",
] as const;
export type MilestoneStatusName = (typeof MILESTONE_STATUS)[number];

export const explorer = run.network.explorer;
export const txUrl = (hash: string) => (explorer ? `${explorer}/tx/${hash}` : null);
export const addressUrl = (addr: string) => (explorer ? `${explorer}/address/${addr}` : null);

export const short = (hex: string, n = 4) => `${hex.slice(0, 2 + n)}...${hex.slice(-n)}`;

export const fmtToken = (raw: string | bigint | number) => {
  const v = Number(BigInt(raw)) / 1e6;
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const fmtDate = (unix: string | number) =>
  new Date(Number(unix) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export const fmtDateTime = (unix: string | number) =>
  new Date(Number(unix) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";

export const stepByKey = (key: string) => {
  const s = run.steps.find((x) => x.key === key);
  if (!s) throw new Error(`missing step ${key}`);
  return s;
};

export type MilestoneView = {
  index: number;
  phase: string;
  amount: bigint;
  funded: bigint;
  dueDate: number;
  status: MilestoneStatusName;
  proofHash?: string;
  proofURI?: string;
  extendedFrom?: number;
};

export type BoardView = {
  version: number;
  scopeHash?: string;
  baselineHash?: string;
  accepted: boolean;
  milestones: MilestoneView[];
  escrowed: bigint;
  paidOut: bigint;
};

const phaseLabel = (hex: string) => hexToString(hex as `0x${string}`, { size: 32 });

/** Rebuilds the agreement board from recorded contract events, up to and including step `uptoKey`. */
export function boardAt(uptoKey: string | null): BoardView {
  const view: BoardView = { version: 0, accepted: false, milestones: [], escrowed: 0n, paidOut: 0n };
  if (uptoKey === null) return view;
  for (const step of run.steps) {
    for (const ev of step.events) {
      const a = ev.args;
      const m = a.index !== undefined ? view.milestones[Number(a.index)] : undefined;
      switch (ev.name) {
        case "AgreementCreated":
          view.scopeHash = String(a.scopeHash);
          break;
        case "MilestoneAdded":
          view.milestones.push({
            index: Number(a.index),
            phase: phaseLabel(String(a.phaseRef)),
            amount: BigInt(a.amount),
            funded: 0n,
            dueDate: Number(a.dueDate),
            status: "Pending",
          });
          break;
        case "AgreementAccepted":
          view.accepted = true;
          view.version = 1;
          view.baselineHash = String(a.baselineHash);
          break;
        case "MilestoneFunded":
          if (m) {
            m.funded = BigInt(a.fundedTotal);
            if (m.status === "Pending") m.status = "Funded";
            view.escrowed += BigInt(a.amount);
          }
          break;
        case "ProofSubmitted":
          if (m) {
            m.status = "Submitted";
            m.proofHash = String(a.proofHash);
            m.proofURI = String(a.proofURI);
          }
          break;
        case "MilestoneReleased":
          if (m) {
            m.status = "Released";
            view.escrowed -= BigInt(a.amount);
            view.paidOut += BigInt(a.amount);
            m.funded = 0n;
          }
          break;
        case "ChangeOrderApproved": {
          const t = view.milestones[Number(a.milestoneIndex)];
          const proposed = run.steps
            .flatMap((s) => s.events)
            .find((e) => e.name === "ChangeOrderProposed" && String(e.args.changeOrderId) === String(a.changeOrderId));
          if (t && proposed) {
            t.amount += BigInt(proposed.args.costDelta);
            t.extendedFrom = Number(a.previousDueDate);
            t.dueDate = Number(a.newDueDate);
            if (t.status === "Submitted") t.status = "Funded";
          }
          view.version = Number(a.newVersion);
          view.scopeHash = String(proposed?.args.newScopeHash ?? view.scopeHash);
          break;
        }
      }
    }
    if (step.key === uptoKey) break;
  }
  return view;
}
