"use client";

import { useMemo } from "react";
import { hashDocument } from "@/lib/canonical";
import { short } from "@/lib/run";

/** Recomputes a document hash in the browser and compares it with the value recorded on chain. */
export function HashCheck({ doc, onChain, label }: { doc: unknown; onChain: string; label: string }) {
  // Computed on the client from the same document the page shows; nothing is trusted from the recording.
  const local: string | null = useMemo(() => hashDocument(doc), [doc]);
  const match = local !== null && local.toLowerCase() === onChain.toLowerCase();
  return (
    <div className="rounded-none border border-line bg-ink/60 p-3 font-mono text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-wider text-dim">{label}</span>
        <span
          aria-live="polite"
          className={local === null ? "text-muted" : match ? "text-ok" : "text-zilla-soft"}
        >
          {local === null ? "Hashing..." : match ? "✓ Match" : "✕ Mismatch"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
        <span>Browser</span>
        <span className="truncate text-bone/90" title={local ?? ""}>
          {local ? short(local, 10) : "..."}
        </span>
        <span>On chain</span>
        <span className="truncate text-bone/90" title={onChain}>
          {short(onChain, 10)}
        </span>
      </div>
    </div>
  );
}
