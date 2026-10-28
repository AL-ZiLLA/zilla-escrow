"use client";

import { useState } from "react";
import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { escrowAbi } from "@/lib/abi";
import { run } from "@/lib/run";

type Result = { ok: boolean; lines: string[] };

/** Reads the agreement straight from Arbitrum Sepolia over the public RPC and compares it with the recording. */
export function LiveCheck() {
  const [state, setState] = useState<"idle" | "loading" | Result>("idle");
  if (run.network.chainId !== arbitrumSepolia.id) {
    return (
      <p className="text-sm text-muted">
        This recording comes from a local rehearsal chain, so there is no public chain to read yet. Once the run is
        repeated on Arbitrum Sepolia this panel reads the live contract over the public RPC.
      </p>
    );
  }
  const check = async () => {
    setState("loading");
    try {
      const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });
      const a = await client.readContract({
        address: run.contracts.escrow as `0x${string}`,
        abi: escrowAbi,
        functionName: "getAgreement",
        args: [BigInt(run.agreementId)],
      });
      const rec = run.final.agreement;
      const pairs: [string, string, string][] = [
        ["Baseline hash", a.baselineHash, String(rec.baselineHash)],
        ["Current scope hash", a.scopeHash, String(rec.scopeHash)],
        ["Scope version", String(a.version), String(rec.version)],
        ["Milestones", String(a.milestoneCount), String(rec.milestoneCount)],
      ];
      const ok = pairs.every(([, x, y]) => x.toLowerCase() === y.toLowerCase());
      setState({ ok, lines: pairs.map(([k, x, y]) => `${x.toLowerCase() === y.toLowerCase() ? "✓" : "✕"} ${k}`) });
    } catch (e) {
      setState({ ok: false, lines: [`Could not reach the public RPC: ${e instanceof Error ? e.message.split("\n")[0] : "error"}`] });
    }
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={check}
        disabled={state === "loading"}
        className="rounded-none border border-zilla/70 bg-zilla/10 px-4 py-2 text-sm font-semibold hover:bg-zilla/20 disabled:opacity-50"
      >
        {state === "loading" ? "Reading chain..." : "Read live state from Arbitrum Sepolia"}
      </button>
      {typeof state === "object" ? (
        <ul aria-live="polite" className={`font-mono text-xs ${state.ok ? "text-ok" : "text-zilla-soft"}`}>
          {state.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
