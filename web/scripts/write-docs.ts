// Writes the synthetic scope and proof documents to public/demo so the app and the on-chain URIs resolve.
import { mkdirSync, writeFileSync } from "node:fs";
import { proofP1, proofP2, scopeV1, scopeV2 } from "../src/lib/scope";
const dir = new URL("../public/demo/", import.meta.url);
mkdirSync(dir, { recursive: true });
const docs = { "scope-v1.json": scopeV1, "scope-v2.json": scopeV2, "proof-p1.json": proofP1, "proof-p2.json": proofP2 };
for (const [name, doc] of Object.entries(docs)) writeFileSync(new URL(name, dir), JSON.stringify(doc, null, 2) + "\n");
console.log("wrote public/demo/*.json");
