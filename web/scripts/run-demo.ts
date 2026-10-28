/**
 * Runs the full demo flow on a chain and records it to src/data/run.json for the web app.
 *
 *   KEYS_FILE=/path/outside/repo.env RPC_URL=... NETWORK=arbitrum-sepolia pnpm demo:run
 *
 * KEYS_FILE holds DEPLOYER_PK, CLIENT_PK, PROVIDER_PK, AGENT_PK, ARBITER_PK (testnet only).
 * Keys are read from that file and never logged or written anywhere.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { escrowAbi, tokenAbi } from "../src/lib/abi";
import { hashDocument, phaseRef } from "../src/lib/canonical";
import { changeRequest, proofP1, proofP2, scopeV1, scopeV2, units } from "../src/lib/scope";

const NETWORKS = {
  local: { id: 31337, name: "Local Anvil rehearsal", explorer: null },
  "arbitrum-sepolia": { id: 421614, name: "Arbitrum Sepolia", explorer: "https://sepolia.arbiscan.io" },
} as const;

type NetKey = keyof typeof NETWORKS;
const netKey = (process.env.NETWORK ?? "local") as NetKey;
const net = NETWORKS[netKey];
if (!net) throw new Error(`unknown NETWORK ${netKey}`);
const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const keysFile = process.env.KEYS_FILE;
if (!keysFile) throw new Error("KEYS_FILE is required");

const env = Object.fromEntries(
  readFileSync(keysFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).replace(/^export\s+/, ""), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);
const acct = (k: string) => {
  const v = env[k];
  if (!v) throw new Error(`${k} missing from KEYS_FILE`);
  return privateKeyToAccount((v.startsWith("0x") ? v : `0x${v}`) as Hex);
};

const chain = defineChain({
  id: net.id,
  name: net.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const pub = createPublicClient({ chain, transport: http(rpc) });
const roles = {
  deployer: acct("DEPLOYER_PK"),
  client: acct("CLIENT_PK"),
  provider: acct("PROVIDER_PK"),
  agent: acct("AGENT_PK"),
  arbiter: acct("ARBITER_PK"),
};
const wallet = (a: (typeof roles)[keyof typeof roles]) =>
  createWalletClient({ account: a, chain, transport: http(rpc) });

const artifact = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../contracts/out/${name}.sol/${name}.json`, import.meta.url), "utf8"))
    .bytecode.object as Hex;

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));

type Step = {
  key: string;
  title: string;
  role: keyof typeof roles;
  txHash: Hash;
  block: number;
  timestamp: number;
  gasUsed: string;
  events: { name: string; args: Record<string, unknown> }[];
};
const steps: Step[] = [];

async function record(key: string, title: string, role: keyof typeof roles, hash: Hash) {
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${key} reverted`);
  const b = await pub.getBlock({ blockNumber: r.blockNumber });
  const events = parseEventLogs({ abi: [...escrowAbi, ...tokenAbi], logs: r.logs }).map((l) => ({
    name: l.eventName,
    args: json(l.args),
  }));
  steps.push({
    key,
    title,
    role,
    txHash: hash,
    block: Number(r.blockNumber),
    timestamp: Number(b.timestamp),
    gasUsed: r.gasUsed.toString(),
    events,
  });
  console.log(`ok  ${key.padEnd(18)} ${hash}`);
  return r;
}

async function deploy(name: string, label: string) {
  const w = wallet(roles.deployer);
  const hash = await w.deployContract({
    abi: name === "ZillaEscrow" ? escrowAbi : tokenAbi,
    bytecode: artifact(name),
  });
  const r = await record(`deploy-${name}`, label, "deployer", hash);
  return r.contractAddress!;
}

async function main() {
  const chainId = await pub.getChainId();
  if (chainId !== net.id) throw new Error(`RPC chain ${chainId} does not match ${netKey}`);
  if (![31337, 421614].includes(chainId)) throw new Error("testnet only");

  // Top up gas for the role accounts from the deployer (testnet ETH only; one faucet claim covers all).
  const gasFloor = BigInt(process.env.GAS_FLOOR_WEI ?? "300000000000000"); // 0.0003 ETH
  for (const role of ["client", "provider", "agent"] as const) {
    const bal = await pub.getBalance({ address: roles[role].address });
    if (bal < gasFloor) {
      const h = await wallet(roles.deployer).sendTransaction({ to: roles[role].address, value: gasFloor - bal });
      await pub.waitForTransactionReceipt({ hash: h });
      console.log(`gas ${role.padEnd(16)} ${h}`);
    }
  }

  const token = await deploy("MockStablecoin", "Deploy mock test token (no value)");
  const escrow = await deploy("ZillaEscrow", "Deploy ZillaEscrow");
  const deployBlock = steps[0].block;

  const c = wallet(roles.client);
  const p = wallet(roles.provider);
  const g = wallet(roles.agent);
  const now = Number((await pub.getBlock()).timestamp);
  const day = 86400;
  const v1 = hashDocument(scopeV1);
  const v2 = hashDocument(scopeV2);

  let due = now;
  const milestones = scopeV1.phases.map((ph) => {
    due += ph.durationDays * day;
    return { amount: units(ph.amount), dueDate: BigInt(due), phaseRef: phaseRef(ph.ref) };
  });
  const created = await record(
    "create",
    "Provider creates the agreement from the scope",
    "provider",
    await p.writeContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "createAgreement",
      args: [
        {
          client: roles.client.address,
          provider: roles.provider.address,
          agent: roles.agent.address,
          arbiter: roles.arbiter.address,
          token,
          scopeHash: v1,
          scopeURI: "/demo/scope-v1.json",
          milestones,
        },
      ],
    }),
  );
  const [createdLog] = parseEventLogs({ abi: escrowAbi, eventName: "AgreementCreated", logs: created.logs });
  const id = createdLog.args.agreementId as bigint;
  await record(
    "accept",
    "Client signs: scope hash matches, baseline frozen",
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "acceptAgreement", args: [id, v1, roles.agent.address] }),
  );
  const total = units(scopeV2.phases.reduce((s, x) => s + x.amount, 0));
  await record(
    "mint",
    "Client takes mock test tokens from the faucet",
    "client",
    await c.writeContract({ address: token, abi: tokenAbi, functionName: "mint", args: [roles.client.address, total] }),
  );
  await record(
    "approve",
    "Client allows the escrow to pull deposits",
    "client",
    await c.writeContract({ address: token, abi: tokenAbi, functionName: "approve", args: [escrow, total] }),
  );
  await record(
    "fund-p1",
    "Client funds P1",
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "fundMilestone", args: [id, 0n] }),
  );
  await record(
    "proof-p1",
    "Agent posts the P1 proof pack",
    "agent",
    await g.writeContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "submitProof",
      args: [id, 0n, hashDocument(proofP1), "/demo/proof-p1.json"],
    }),
  );
  await record(
    "release-p1",
    "Client releases P1 in one click",
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "release", args: [id, 0n] }),
  );
  await record(
    "fund-p2",
    "Client funds P2",
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "fundMilestone", args: [id, 1n] }),
  );
  const p2 = (await pub.readContract({
    address: escrow,
    abi: escrowAbi,
    functionName: "getMilestone",
    args: [id, 1n],
  })) as { dueDate: bigint };
  await record(
    "co-propose",
    `Provider proposes ${changeRequest.id}: ${changeRequest.title}`,
    "provider",
    await p.writeContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "proposeChangeOrder",
      args: [
        id,
        {
          target: 1,
          costDelta: units(changeRequest.costDelta),
          newDueDate: p2.dueDate + BigInt(changeRequest.scheduleImpactDays * day),
          phaseRef: phaseRef(changeRequest.id),
          newScopeHash: v2,
          reasonURI: "/demo/scope-v2.json",
        },
      ],
    }),
  );
  await record(
    "co-approve",
    `Client approves ${changeRequest.id}: scope v2, date extended`,
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "approveChangeOrder", args: [id, 0n] }),
  );
  await record(
    "fund-co",
    `Client tops up P2 for ${changeRequest.id}`,
    "client",
    await c.writeContract({ address: escrow, abi: escrowAbi, functionName: "fundMilestone", args: [id, 1n] }),
  );
  await record(
    "proof-p2",
    "Agent posts the P2 proof pack",
    "agent",
    await g.writeContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "submitProof",
      args: [id, 1n, hashDocument(proofP2), "/demo/proof-p2.json"],
    }),
  );

  const agreement = await pub.readContract({ address: escrow, abi: escrowAbi, functionName: "getAgreement", args: [id] });
  const ms = await pub.readContract({ address: escrow, abi: escrowAbi, functionName: "getMilestones", args: [id] });
  const held = await pub.readContract({ address: escrow, abi: escrowAbi, functionName: "escrowed", args: [token] });

  const out = {
    generatedAt: new Date().toISOString(),
    network: { key: netKey, name: net.name, chainId, explorer: net.explorer },
    contracts: { escrow, token, deployBlock },
    roles: Object.fromEntries(Object.entries(roles).map(([k, a]) => [k, a.address])),
    agreementId: id.toString(),
    hashes: { scopeV1: v1, scopeV2: v2, proofP1: hashDocument(proofP1), proofP2: hashDocument(proofP2) },
    steps,
    final: json({ agreement, milestones: ms, escrowed: held }),
  };
  writeFileSync(new URL("../src/data/run.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote src/data/run.json (${steps.length} txs, agreement ${id})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
