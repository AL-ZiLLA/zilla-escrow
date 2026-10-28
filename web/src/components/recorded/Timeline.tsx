import { fmtDateTime, ROLE_LABEL, run, txUrl } from "@/lib/run";
import { TxLink } from "./ui";

const EVENT_TONE: Record<string, string> = {
  AgreementCreated: "text-bone",
  AgreementAccepted: "text-bone",
  MilestoneAdded: "text-muted",
  MilestoneFunded: "text-warn",
  ProofSubmitted: "text-sky-300",
  MilestoneReleased: "text-ok",
  ChangeOrderProposed: "text-zilla-soft",
  ChangeOrderApproved: "text-zilla-soft",
  Transfer: "text-dim",
  Approval: "text-dim",
};

/** Every recorded transaction, oldest first, with the contract events it emitted. */
export function Timeline() {
  return (
    <ol className="relative space-y-0 border-l border-line pl-6 sm:pl-8">
      {run.steps.map((s, i) => {
        const counts = s.events.reduce<Record<string, number>>((acc, e) => {
          acc[e.name] = (acc[e.name] ?? 0) + 1;
          return acc;
        }, {});
        const logsUrl = txUrl(s.txHash) ? `${txUrl(s.txHash)}#eventlog` : null;
        return (
          <li key={s.txHash} className="relative pb-6 last:pb-0">
            <span
              aria-hidden
              className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ring-4 ring-ink sm:-left-[37px] ${
                s.key.startsWith("deploy") ? "bg-dim" : "bg-zilla"
              }`}
            />
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline">
              <span className="font-mono text-[11px] text-dim">#{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                  <span className="text-muted">{ROLE_LABEL[s.role]}</span>
                  {Object.entries(counts).map(([name, c]) =>
                    logsUrl ? (
                      <a
                        key={name}
                        href={logsUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`View ${name} in the Arbiscan event log`}
                        className={`underline decoration-line underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zilla ${EVENT_TONE[name] ?? "text-muted"}`}
                      >
                        {name}
                        {c > 1 ? ` ×${c}` : ""}
                      </a>
                    ) : (
                      <span key={name} className={EVENT_TONE[name] ?? "text-muted"}>
                        {name}
                        {c > 1 ? ` ×${c}` : ""}
                      </span>
                    ),
                  )}
                  {s.key.startsWith("deploy") ? <span className="text-dim">contract creation</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted sm:justify-end sm:text-right">
                <span className="font-mono">
                  block {s.block} · {fmtDateTime(s.timestamp)}
                </span>
                <TxLink hash={s.txHash} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
