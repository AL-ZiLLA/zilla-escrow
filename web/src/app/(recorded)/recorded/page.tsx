import Link from "next/link";
import { LiveCheck } from "@/components/recorded/LiveCheck";
import { Timeline } from "@/components/recorded/Timeline";
import { AddressLink, Card, Eyebrow, SectionTitle } from "@/components/recorded/ui";
import { Walkthrough } from "@/components/recorded/Walkthrough";
import tests from "@/data/tests.json";
import { ROLE_LABEL, run, type RoleKey } from "@/lib/run";
import { REPO_URL } from "@/lib/site";
import { priorDeployment } from "@/lib/escrow/deployment";

const isLocal = run.network.chainId === 31337;

const DESK_MAP: [string, string][] = [
  ["Signed baseline", "baselineHash, frozen when the client accepts"],
  ["Scope version", "version and scopeHash, bumped by each approved change"],
  ["Phase payment", "Milestone: amount, funded, due date, phase ref"],
  ["Proof pack", "proofHash and proofURI posted by the agent"],
  ["Change request", "ChangeOrder: cost delta, new due date, new scope hash"],
  ["Approved schedule impact", "ChangeOrderApproved event with previous and new due date"],
];

const GUARDS: [string, string][] = [
  ["No admin", "No owner, no pause, no upgrade. Funds move only by the rules below."],
  ["Reentrancy guard", "Every state-changing call is non-reentrant and updates state before paying out."],
  ["Exact accounting", "Fee-on-transfer tokens are rejected, so held funds always equal the token balance."],
  ["Stale change orders", "A change priced on an older scope version cannot be approved."],
  ["Silent client", "The provider can claim 14 days after posting proof if the client never responds."],
  ["Missed deadline", "The client can take back a funded phase 7 days after its due date if no proof was posted."],
  ["Disputes", "Either party can freeze a phase. A named arbiter splits it, and the remainder goes to the client."],
  ["Silent arbiter", "If the arbiter has not ruled 30 days after a dispute opens, either party can settle: an even split if proof was posted, otherwise a full refund to the client."],
  ["Delivered work stays protected", "Once proof is posted, the missed-deadline refund no longer applies, even if a later change order raises the price."],
  ["Agent changes need consent", "After acceptance the provider can only propose a new delivery agent. The client must approve it."],
];

export default function Home() {
  return (
    <div className="grid-bg">
      <a href="#demo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-zilla focus:px-3 focus:py-2">
        Skip to demo
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a href="#top" className="flex min-h-11 items-center gap-2.5 whitespace-nowrap font-display text-lg uppercase tracking-wide">
            {/* eslint-disable-next-line @next/next/no-img-element -- official flat mark, used as is */}
            <img src="/zilla-logo.svg" alt="" width={28} height={28} className="size-7" />
            Zilla Escrow
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <Link className="hover:text-bone" href="/">Escrow app</Link>
            <a className="hover:text-bone" href="#demo">Demo</a>
            <a className="hover:text-bone" href="#audit">Audit trail</a>
            <a className="hover:text-bone" href="#contract">Contract</a>
            {REPO_URL ? (
              <a className="hover:text-bone" href={REPO_URL} target="_blank" rel="noreferrer">
                Source ↗
              </a>
            ) : null}
          </nav>
          <p
            className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${
              "border-warn/50 text-warn"
            }`}
          >
            <span className="sr-only">Network: </span>
            <span className="sm:hidden">Testnet</span>
            <span className="hidden sm:inline">{isLocal ? "Testnet · Local rehearsal" : `${run.network.name} testnet`}</span>
            <span className="hidden lg:inline"> · Not audited · test tokens, no value</span>
          </p>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-7xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
          <Eyebrow>Zilla Labs · Built on Arbitrum · Demo. Not audited.</Eyebrow>
          <h1 className="mt-5 max-w-4xl text-6xl leading-[0.92] font-display tracking-wide uppercase sm:text-8xl">
            Pay for work <span className="text-zilla">that ships.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Milestone escrow for agent-run service work. The client funds each phase, the delivery agent posts proof,
            and the client releases with one click. Change orders add funds and move dates only when both sides agree.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#demo"
              className="rounded-none bg-zilla px-5 py-3 text-sm font-black tracking-wide uppercase hover:bg-zilla-soft"
            >
              Walk through the demo
            </a>
            <a
              href="#audit"
              className="rounded-none border border-line bg-panel px-5 py-3 text-sm font-semibold hover:border-bone/40"
            >
              See the audit trail
            </a>
          </div>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-none border border-line bg-line sm:grid-cols-3">
            {[
              ["Non-custodial", "Funds sit in the contract. No owner, no admin key."],
              ["Signed scope", "The client signs a hash of the scope. The baseline never changes."],
              ["Every step on chain", `${run.steps.length} recorded transactions rebuild this page.`],
            ].map(([k, v]) => (
              <li key={k} className="bg-panel p-5">
                <p className="font-display uppercase tracking-wide">{k}</p>
                <p className="mt-1.5 text-sm text-muted">{v}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="demo" className="scroll-mt-20 border-t border-line bg-ink/60 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionTitle
              eyebrow="Demo · Fictional data"
              title="One project, start to finish"
              lede={
                <>
                  A fictional studio builds a website for a fictional bakery. Every name, amount and deliverable is
                  made up, and payments use a mock token with no value.{" "}
                  {isLocal
                    ? "This recording comes from a local rehearsal chain. Public explorer links appear once the same run is repeated on Arbitrum Sepolia."
                    : "Every transaction and contract below links to Arbiscan on Arbitrum Sepolia, so each step can be checked on the public testnet."}
                </>
              }
            />
            <Walkthrough />
          </div>
        </section>

        <section id="audit" className="scroll-mt-20 border-t border-line py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionTitle
              eyebrow="Audit trail"
              title="Every change, in order"
              lede="Each row is one transaction and the events the contract emitted. Times are block timestamps in UTC."
            />
            <Card className="p-6 sm:p-8">
              <Timeline />
            </Card>
          </div>
        </section>

        <section id="contract" className="scroll-mt-20 border-t border-line bg-ink/60 py-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-5 sm:px-8 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <SectionTitle
                eyebrow="Under the hood"
                title="The contract"
                lede="One Solidity contract on Arbitrum. The terms of a scope map one to one onto contract fields."
              />
            </div>
            <Card className="p-6">
              <h3 className="font-display uppercase tracking-wide">Scope to contract</h3>
              <dl className="mt-4 divide-y divide-line text-sm">
                {DESK_MAP.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
                    <dt className="text-bone">{k}</dt>
                    <dd className="font-mono text-xs leading-relaxed text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card className="p-6">
              <h3 className="font-display uppercase tracking-wide">Guard rails</h3>
              <dl className="mt-4 divide-y divide-line text-sm">
                {GUARDS.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
                    <dt className="text-bone">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card className="p-6">
              <h3 className="font-display uppercase tracking-wide">Deployment</h3>
              <dl className="mt-4 divide-y divide-line text-sm">
                <Row k="Network" v={`${run.network.name} (chain ${run.network.chainId})`} />
                <Row k="ZillaEscrow" v={<AddressLink address={run.contracts.escrow} />} />
                <Row k="Mock token" v={<AddressLink address={run.contracts.token} />} />
                {(["client", "provider", "agent", "arbiter"] as RoleKey[]).map((r) => (
                  <Row key={r} k={ROLE_LABEL[r]} v={<AddressLink address={run.roles[r]} />} />
                ))}
                <Row
                  k="Prior version"
                  v={
                    <span>
                      <AddressLink address={priorDeployment.escrow} />{" "}
                      <span className="text-muted">first deployment, before the 2026-10-28 review fixes. Superseded.</span>
                    </span>
                  }
                />
              </dl>
              <div className="mt-5 border-t border-line pt-5">
                <LiveCheck />
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-display uppercase tracking-wide">Tests</h3>
              <p className="mt-2 text-sm text-muted">
                Foundry suite run against this contract. Numbers come from the latest local run.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-none border border-line bg-line text-sm">
                {tests.summary.map(([k, v]) => (
                  <div key={k} className="bg-panel p-4">
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-dim">{k}</dt>
                    <dd className="mt-1 text-xl font-black tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 space-y-1 text-xs text-muted">
                {tests.suites.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="text-ok">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-xs leading-relaxed text-dim sm:px-8 md:flex-row md:justify-between">
          <p className="max-w-3xl">
            Testnet demonstration only. Not for real funds. The mock token has no value. All businesses, people,
            amounts and deliverables shown are fictional. A legal review of escrow and money transmission is required
            before any mainnet use. Not audited.
          </p>
          <p className="shrink-0 font-semibold uppercase tracking-wider text-muted">Zilla Labs</p>
        </div>
      </footer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
