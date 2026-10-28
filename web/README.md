# Zilla Escrow demo web app

Next.js app that replays a recorded escrow run. Every number on the page comes from `src/data/run.json` (written by `scripts/run-demo.ts`) and `src/data/tests.json` (written by `scripts/export-tests.mjs`).

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

Regenerate the recording (needs a keys file outside the repo, see the root README):

```bash
pnpm abi            # export the ABI from ../contracts/out
pnpm demo:docs      # write the synthetic scope and proof JSON into public/demo
KEYS_FILE=/path/outside/repo/testnet.env pnpm demo:run   # local anvil by default
```
