"use client";

import { useMemo, useState, type ReactNode } from "react";
import { boardAt, fmtDate, fmtDateTime, fmtToken, ROLE_LABEL, run, stepByKey, type RoleKey } from "@/lib/run";
import { changeRequest, proofP1, scopeV1, scopeV2 } from "@/lib/scope";
import { Board } from "./Board";
import { HashCheck } from "./HashCheck";
import { TxLink } from "./ui";

type Stage = {
  n: number;
  title: string;
  actor: RoleKey;
  txKeys: string[];
  /** Board state shown for this stage. */
  upto: string;
  focus?: number;
};

const STAGES: Stage[] = [
  { n: 1, title: "Create from scope", actor: "provider", txKeys: ["create", "accept"], upto: "accept" },
  { n: 2, title: "Client funds", actor: "client", txKeys: ["mint", "approve", "fund-p1"], upto: "fund-p1", focus: 0 },
  { n: 3, title: "Agent posts proof", actor: "agent", txKeys: ["proof-p1"], upto: "proof-p1", focus: 0 },
  { n: 4, title: "One-click release", actor: "client", txKeys: ["release-p1"], upto: "release-p1", focus: 0 },
  {
    n: 5,
    title: "Change order",
    actor: "provider",
    txKeys: ["fund-p2", "co-propose", "co-approve", "fund-co", "proof-p2"],
    upto: "proof-p2",
    focus: 1,
  },
  { n: 6, title: "Audit trail", actor: "client", txKeys: [], upto: "proof-p2" },
];

const v2Phase = scopeV2.phases.find((p) => p.ref === changeRequest.target)!;
const v1Phase = scopeV1.phases.find((p) => p.ref === changeRequest.target)!;

export function Walkthrough() {
  const [active, setActive] = useState(0);
  const [released, setReleased] = useState(false);
  const stage = STAGES[active];
  const upto = stage.n === 4 && !released ? "proof-p1" : stage.upto;
  const view = useMemo(() => boardAt(upto), [upto]);

  const go = (i: number) => setActive(Math.max(0, Math.min(STAGES.length - 1, i)));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Demo steps" className="min-w-0">
        <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {STAGES.map((s, i) => {
            const on = i === active;
            const done = i < active;
            return (
              <li key={s.n} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={on ? "step" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-none border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zilla ${
                    on ? "border-zilla/70 bg-zilla/10" : "border-line bg-panel hover:border-bone/30"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center font-mono text-xs font-bold ${
                      on ? "bg-zilla text-bone" : done ? "bg-bone/15 text-bone" : "bg-raised text-muted"
                    }`}
                  >
                    {done ? "✓" : s.n}
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="block font-semibold">{s.title}</span>
                    <span className="block text-[11px] text-dim">{ROLE_LABEL[s.actor]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section key={stage.n} className="rise min-w-0 rounded-none border border-line bg-panel p-5 sm:p-6" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zilla-soft">
            Step {stage.n} of {STAGES.length} · {ROLE_LABEL[stage.actor]}
          </p>
          <h3 className="mt-2 text-2xl font-display uppercase tracking-wide">{stage.title}</h3>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
            <StageBody n={stage.n} released={released} onRelease={() => setReleased(true)} />
          </div>
          {stage.txKeys.length > 0 && (stage.n !== 4 || released) ? <TxList keys={stage.txKeys} /> : null}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => go(active - 1)}
              disabled={active === 0}
              className="min-h-11 rounded-none px-3 py-2 text-sm text-muted hover:text-bone disabled:opacity-30"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              disabled={active === STAGES.length - 1 || (stage.n === 4 && !released)}
              className="min-h-11 rounded-none border border-line bg-raised px-4 py-2 text-sm font-semibold hover:border-bone/40 disabled:opacity-30"
            >
              Next step →
            </button>
          </div>
        </section>
        <aside aria-label="Agreement state" className="min-w-0">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
            Agreement #{run.agreementId} on chain
          </p>
          <Board view={view} highlight={stage.focus} />
        </aside>
      </div>
    </div>
  );
}

function TxList({ keys }: { keys: string[] }) {
  return (
    <ul className="mt-5 space-y-1.5 rounded-none border border-line bg-ink/50 p-3">
      {keys.map((k) => {
        const s = stepByKey(k);
        return (
          <li key={k} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
            <span className="text-bone/90">
              <span className="text-dim">{ROLE_LABEL[s.role]}:</span> {s.title}
            </span>
            <TxLink hash={s.txHash} />
          </li>
        );
      })}
    </ul>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-zilla" />
      <span>{children}</span>
    </li>
  );
}

function StageBody({ n, released, onRelease }: { n: number; released: boolean; onRelease: () => void }) {
  const total = scopeV1.phases.reduce((s, p) => s + p.amount, 0);
  switch (n) {
    case 1:
      return (
        <>
          <p>
            {scopeV1.provider} turns its scope for {scopeV1.client} into an agreement: three phases, each with
            deliverables, acceptance criteria and a payment. The scope document is hashed and the client signs that
            exact hash.
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {scopeV1.phases.map((p) => (
              <li key={p.ref} className="rounded-none border border-line bg-raised/50 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-dim">{p.ref}</p>
                <p className="font-semibold leading-snug text-bone">{p.name}</p>
                <p className="mt-1 text-xs">{p.amount.toLocaleString("en-US")} mUSDC</p>
              </li>
            ))}
          </ul>
          <HashCheck doc={scopeV1} onChain={run.hashes.scopeV1} label="Scope v1 hash" />
          <p className="text-xs">
            Total {total.toLocaleString("en-US")} mUSDC.{" "}
            <a className="text-bone underline decoration-zilla/60 underline-offset-4" href="/demo/scope-v1.json">
              Open the scope JSON
            </a>
            . Once accepted, the baseline hash is frozen for the life of the agreement.
          </p>
        </>
      );
    case 2:
      return (
        <>
          <p>
            The client deposits the first phase. Funds sit in the contract, not with the provider and not with Zilla.
            The contract has no owner and no admin key.
          </p>
          <ul className="space-y-1.5">
            <Point>Only the client can fund, and only the amount still owed.</Point>
            <Point>Tokens that skim fees on transfer are rejected, so the books always balance.</Point>
            <Point>The demo token is a mock with no value, minted from an open test faucet.</Point>
          </ul>
        </>
      );
    case 3:
      return (
        <>
          <p>
            The delivery agent posts a proof pack: the artifacts and a check against each acceptance criterion. Only
            its hash goes on chain, so the work stays private while staying tamper evident.
          </p>
          <ul className="space-y-1.5">
            {proofP1.checks.map((c) => (
              <Point key={c.criterion}>
                <span className="text-bone">{c.criterion}</span>: {c.result}
              </Point>
            ))}
          </ul>
          <HashCheck doc={proofP1} onChain={run.hashes.proofP1} label="P1 proof hash" />
          <p className="text-xs">
            If the client goes quiet, the provider can claim {scopeV1.terms.reviewPeriodDays} days after a proof is
            posted.
          </p>
        </>
      );
    case 4:
      return released ? (
        <div className="rise space-y-3">
          <p className="text-base text-ok">
            ✓ Released {fmtToken(String(stepByKey("release-p1").events.find((e) => e.name === "MilestoneReleased")?.args.amount ?? 0))}{" "}
            mUSDC to the provider.
          </p>
          <p>
            One transaction, signed by the client, recorded at {fmtDateTime(stepByKey("release-p1").timestamp)}. P1 is
            now final and cannot be refunded or disputed.
          </p>
        </div>
      ) : (
        <>
          <p>The client reviews the proof and pays the phase with one click.</p>
          <button
            type="button"
            onClick={onRelease}
            className="w-full rounded-none bg-zilla px-5 py-4 text-base font-black uppercase tracking-wide text-bone transition hover:bg-zilla-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
          >
            Release {scopeV1.phases[0].amount.toLocaleString("en-US")} mUSDC
          </button>
          <p className="text-xs text-dim">
            Replays the recorded transaction. This page holds no keys and sends nothing.
          </p>
        </>
      );
    case 5:
      return (
        <>
          <p>
            Mid-project the client asks for gift card checkout. The provider proposes{" "}
            <span className="text-bone">{changeRequest.id}</span> against the scope version it was priced on. It
            takes effect only when the client approves on chain.
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Delta label="P2 price" from={`${v1Phase.amount.toLocaleString("en-US")}`} to={`${v2Phase.amount.toLocaleString("en-US")}`} />
            <Delta label="P2 due date" from={fmtDate(boardAt("fund-p2").milestones[1].dueDate)} to={fmtDate(boardAt("proof-p2").milestones[1].dueDate)} />
            <Delta label="Scope version" from="v1" to="v2" />
            <Delta label="Signed baseline" to="Unchanged" />
          </dl>
          <HashCheck doc={scopeV2} onChain={run.hashes.scopeV2} label="Scope v2 hash" />
          <p className="text-xs">
            A stale proposal priced on an older version is rejected, and terms are checked again at approval.
          </p>
        </>
      );
    default:
      return (
        <>
          <p>
            Every state change emits an event, so anyone can rebuild the agreement from the chain alone. The board on
            the right is rebuilt that way from the recorded events.
          </p>
          <ul className="space-y-1.5">
            <Point>P1 paid in full after proof and client release.</Point>
            <Point>P2 funded at the new price, proof posted, waiting on client release.</Point>
            <Point>P3 not funded yet. If a funded phase passes its due date by {scopeV1.terms.refundGraceDays} days with no proof, the client can take it back.</Point>
          </ul>
          <a href="#audit" className="inline-block text-bone underline decoration-zilla/60 underline-offset-4">
            See the full audit trail ↓
          </a>
        </>
      );
  }
}

function Delta({ label, from, to }: { label: string; from?: string; to: string }) {
  return (
    <div className="rounded-none border border-line bg-raised/50 p-3">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className="mt-1 text-sm">
        {from ? (
          <>
            <span className="text-dim line-through">{from}</span> <span aria-hidden>→</span>
            <span className="sr-only">to</span>{" "}
          </>
        ) : null}
        <span className="font-semibold text-bone">{to}</span>
      </dd>
    </div>
  );
}
