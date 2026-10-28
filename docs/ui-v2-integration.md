# UI v2 integration (local, 2026-10-28)

Source: Codex handoff `zilla-escrow-ui` (SHA256SUMS verified 185/185).

## Layout
- `web/src/app/(escrow)/`: handoff app (16 routes, `/` is the escrow landing). Root layout imports `globals.css` then `refinement.css`, keeps the theme startup script, ThemeToggle and DemoProvider.
- `web/src/app/(recorded)/recorded/`: previous recorded Arbitrum Sepolia demo, kept intact with its own root layout and `recorded.css` (the previous Tailwind globals). Separate root layouts keep the unlayered handoff CSS from touching it.
- `web/src/components/recorded/`: previous demo components (moved, unchanged apart from imports).
- `web/src/lib/escrow/deployment.ts`: reads the recorded deployment from `src/data/run.json`. Not wired into the UI fixtures. Confirm against OPEN-QUESTIONS item 1 before use.
- ABI, contracts, scripts, `run.json`, `tests.json` unchanged.

## Notes
- Wallet and transaction controls are UI simulations. No wallet calls, no transactions.
- All handoff design files are byte-identical to the handoff, except the layout CSS import paths.
- Screenshots: `docs/screenshots/ui-v2/` (1280 and 390, dark and light, plus variants).

## Deploy
- Vercel project `zilla-escrow` on team `al-zillas-projects`, root directory `web/`, framework Next.js, Node 22.x. Production branch `main`; this branch deploys as a preview only.
