import Link from 'next/link';
import { TestnetBadge } from './TestnetBadge';
import { WalletChip } from './WalletChip';
import type { Role } from '@/lib/escrow/model';
import { ThemeToggle } from './ThemeToggle';
export function Header({ address, role, onConnect }: { address?: string; role: Role; onConnect?: () => void }) {
  return <header className="esc-header"><div className="esc-header-row"><Link className="esc-brand" href="/">
    {/* eslint-disable-next-line @next/next/no-img-element -- official unmodified SVG */}
    <img src="/zilla-logo-official.svg" width="36" height="36" alt="" /><span>Zilla <b>Escrow</b><small>by Zilla Labs</small></span></Link>
    <div className="esc-header-context"><span className="esc-context-dot"/> Milestone escrow <span>/</span> Arbitrum Sepolia</div><div className="esc-header-actions"><ThemeToggle/><WalletChip address={address} role={role} onConnect={onConnect}/></div></div><TestnetBadge/></header>;
}
