import type { ReactNode } from "react";
import { addressUrl, short, txUrl, type MilestoneStatusName } from "@/lib/run";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zilla-soft">{children}</p>
  );
}

export function SectionTitle({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <header className="mb-10 max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-display uppercase tracking-wide sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-4 text-base leading-relaxed text-muted">{lede}</p> : null}
    </header>
  );
}

const STATUS_STYLE: Record<MilestoneStatusName, string> = {
  Pending: "border-line text-muted",
  Funded: "border-warn/40 bg-warn/10 text-warn",
  Submitted: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  Released: "border-ok/40 bg-ok/10 text-ok",
  Refunded: "border-line bg-raised text-muted",
  Disputed: "border-zilla/50 bg-zilla/10 text-zilla-soft",
  Resolved: "border-line bg-raised text-bone",
};

export function StatusPill({ status }: { status: MilestoneStatusName }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function Hash({ value, n = 6, label }: { value: string; n?: number; label?: string }) {
  return (
    <code title={value} aria-label={label ? `${label} ${value}` : value} className="font-mono text-xs text-bone/90">
      {short(value, n)}
    </code>
  );
}

export function TxLink({ hash }: { hash: string }) {
  const url = txUrl(hash);
  if (!url) return <Hash value={hash} label="transaction" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-bone underline decoration-zilla/60 underline-offset-4 hover:decoration-zilla"
    >
      {short(hash, 6)} <span aria-hidden>↗</span>
      <span className="sr-only">(opens explorer)</span>
    </a>
  );
}

export function AddressLink({ address }: { address: string }) {
  const url = addressUrl(address);
  if (!url) return <Hash value={address} label="address" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-bone underline decoration-zilla/60 underline-offset-4 hover:decoration-zilla"
    >
      {short(address, 6)} <span aria-hidden>↗</span>
      <span className="sr-only">(opens explorer)</span>
    </a>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-none border border-line bg-panel ${className}`}>{children}</div>;
}
