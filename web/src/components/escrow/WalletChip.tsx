'use client';
import { short, type Role } from '@/lib/escrow/model';
export function WalletChip({ address, role, onConnect }: { address?: string; role: Role; onConnect?: () => void }) {
  return address ? <span className="esc-wallet" title={`Preview as ${role}. Sample address ${short(address)}. No wallet connected.`} tabIndex={0}><span className="green">●</span> Preview as <span className="esc-chip">{role}</span><small>Arbitrum Sepolia</small></span> : <button className="esc-button" onClick={onConnect}>Connect wallet</button>;
}
