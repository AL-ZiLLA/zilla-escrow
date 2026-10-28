import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TestnetBadge } from '@/components/escrow/TestnetBadge';
import { UnlockForm } from './UnlockForm';

export const metadata: Metadata = { title: 'Zilla Escrow | Unlock demo' };

export default function UnlockPage() {
  return <div className="esc-unlock">
    <header className="esc-header"><div className="esc-header-row"><span className="esc-brand">
      {/* eslint-disable-next-line @next/next/no-img-element -- official unmodified SVG */}
      <img src="/zilla-logo-official.svg" width="36" height="36" alt="" /><span>Zilla <b>Escrow</b><small>by Zilla Labs</small></span></span>
      <div className="esc-header-context"><span className="esc-context-dot"/> Milestone escrow <span>/</span> Arbitrum Sepolia</div></div><TestnetBadge/></header>
    <main className="esc-main" id="main">
      <div className="esc-page-title"><p className="esc-eyebrow">Zilla OS · Built on Arbitrum · Testnet demo</p><h1>Enter the demo password.</h1><p>This preview is shared with reviewers only. Wallet and transaction actions inside are UI simulations; the real testnet record is linked from the app.</p></div>
      <Suspense fallback={<div className="esc-form esc-panel esc-unlock-panel" aria-busy="true"/>}><UnlockForm/></Suspense>
    </main>
  </div>;
}
