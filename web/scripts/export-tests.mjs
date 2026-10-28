// Runs the Foundry suite and coverage, and writes the real numbers to src/data/tests.json.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const cwd = new URL("../../contracts/", import.meta.url).pathname;
const sh = (cmd) => execSync(cmd, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const results = JSON.parse(sh("forge test --json"));
let passed = 0, failed = 0, fuzzRuns = 0;
const suites = [];
for (const [name, suite] of Object.entries(results)) {
  const tests = Object.entries(suite.test_results);
  const ok = tests.filter(([, t]) => t.status === "Success").length;
  passed += ok;
  failed += tests.length - ok;
  for (const [, t] of tests) {
    if (t.kind?.Fuzz) fuzzRuns += t.kind.Fuzz.runs;
    if (t.kind?.Invariant) fuzzRuns += t.kind.Invariant.calls;
  }
  suites.push(`${name.split(":")[1]}: ${ok} of ${tests.length} passing`);
}
const cov = sh('forge coverage --report summary --no-match-coverage "test|script"');
const line = cov.split("\n").find((l) => l.includes("src/ZillaEscrow.sol"));
const pct = line ? line.split("|").slice(2, 5).map((c) => c.trim().split(" ")[0]) : ["n/a", "n/a", "n/a"];

const out = {
  generatedAt: new Date().toISOString(),
  passed,
  failed,
  summary: [
    ["Tests passing", `${passed} / ${passed + failed}`],
    ["Fuzz and invariant calls", fuzzRuns.toLocaleString("en-US")],
    ["Line coverage", pct[0]],
    ["Branch coverage", pct[2]],
  ],
  suites,
};
writeFileSync(new URL("../src/data/tests.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
if (failed) process.exit(1);
