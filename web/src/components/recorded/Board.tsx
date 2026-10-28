import type { ReactNode } from "react";
import { fmtDate, fmtToken, type BoardView } from "@/lib/run";
import { scopeV2 } from "@/lib/scope";
import { Hash, StatusPill } from "./ui";

const phaseName = (ref: string) => scopeV2.phases.find((p) => p.ref === ref)?.name ?? ref;

/** The agreement as the contract sees it at a point in the recorded run. */
export function Board({ view, highlight }: { view: BoardView; highlight?: number }) {
  if (view.milestones.length === 0) {
    return (
      <div className="grid h-full min-h-64 place-items-center rounded-none border border-dashed border-line p-8 text-center text-sm text-muted">
        No agreement on chain yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-none border border-line bg-line text-xs sm:grid-cols-4">
        <Stat label="Scope version" value={view.accepted ? `v${view.version}` : "Unsigned"} />
        <Stat label="Held in escrow" value={`${fmtToken(view.escrowed)} mUSDC`} />
        <Stat label="Paid to provider" value={`${fmtToken(view.paidOut)} mUSDC`} />
        <Stat
          label="Baseline"
          value={view.baselineHash ? <Hash value={view.baselineHash} n={4} label="baseline hash" /> : "Not frozen"}
        />
      </dl>
      <ol className="space-y-3">
        {view.milestones.map((m) => {
          const pct = m.amount === 0n ? 0 : Number((m.funded * 100n) / m.amount);
          const paid = m.status === "Released";
          return (
            <li
              key={m.index}
              className={`rounded-none border bg-raised/60 p-4 transition-colors ${
                highlight === m.index ? "border-zilla/70" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-dim">{m.phase}</p>
                  <p className="font-semibold">{phaseName(m.phase)}</p>
                </div>
                <StatusPill status={m.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-sm">
                <p>
                  <span className="text-lg font-bold tabular-nums">{fmtToken(m.amount)}</span>
                  <span className="ml-1 text-xs text-muted">mUSDC</span>
                </p>
                <p className="text-xs text-muted">
                  Due{" "}
                  {m.extendedFrom ? (
                    <>
                      <s className="text-dim">{fmtDate(m.extendedFrom)}</s>{" "}
                    </>
                  ) : null}
                  <span className={m.extendedFrom ? "text-bone" : undefined}>{fmtDate(m.dueDate)}</span>
                </p>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-label={`${m.phase} funding`}
                aria-valuenow={paid ? 100 : pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${paid ? "bg-ok" : "bg-zilla"}`}
                  style={{ width: `${paid ? 100 : pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-dim">
                {paid
                  ? "Paid out in full"
                  : m.funded > 0n
                    ? `${fmtToken(m.funded)} of ${fmtToken(m.amount)} funded`
                    : "Not funded yet"}
                {m.proofHash ? (
                  <>
                    {" "}
                    · proof <Hash value={m.proofHash} n={4} label="proof hash" />
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-panel px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
