import { keccak256, stringToHex, toBytes } from "viem";

/** Deterministic JSON: object keys sorted, no whitespace. Same bytes in the browser and in scripts. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/** keccak256 over the canonical UTF-8 bytes. This is what goes on chain as scopeHash or proofHash. */
export function hashDocument(value: unknown): `0x${string}` {
  return keccak256(toBytes(canonicalize(value)));
}

/** Short phase labels stored as readable bytes32 (for example "P1"). */
export function phaseRef(ref: string): `0x${string}` {
  return stringToHex(ref, { size: 32 });
}
