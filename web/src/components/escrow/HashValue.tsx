'use client';
import { useState } from 'react';
import { short, explorer } from '@/lib/escrow/model';
import { isRecorded } from '@/lib/escrow/deployment';
/**
 * Shows a hash or address. Explorer links are only rendered for values from the real
 * recorded testnet run (deployment.ts). Fixture values get a visible "sample" chip and no link.
 */
export function HashValue({ value, kind = 'hash' }: { value: string; kind?: 'hash' | 'tx' | 'address' }) {
  const [copied, setCopied] = useState('');
  const [full, setFull] = useState(false);
  const linkable = kind !== 'hash' && isRecorded(value);
  const sample = kind !== 'hash' && !linkable && value.startsWith('0x');
  return <span className="esc-hash"><span tabIndex={0} title={value} aria-label={`${sample ? 'sample ' : ''}${kind}, ${value}`}>{short(value)}</span>{sample && <span className="esc-chip esc-sample-chip" title="Fictional sample value. Not an onchain record.">sample</span>}<button aria-label={`Copy ${kind} ${short(value)}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied('Copied'); } catch { setCopied('Copy unavailable. Select the full value below.'); }
  }}>Copy</button>{linkable && <a href={`${explorer}/${kind === 'tx' ? 'tx' : 'address'}/${value}`} target="_blank" rel="noreferrer" aria-label={`View testnet ${kind} ${short(value)} on Arbiscan`}>↗</a>}<span className="esc-sr" role="status">{copied}</span><span className="esc-hash-full"><button aria-label={`Full ${kind}`} aria-expanded={full} onClick={() => setFull(!full)}>Full</button>{full && <code>{value}</code>}</span></span>;
}
