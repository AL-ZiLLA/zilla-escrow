'use client';
import { useState } from 'react';
import { short, explorer } from '@/lib/escrow/model';
export function HashValue({ value, kind = 'hash', synthetic = true }: { value: string; kind?: 'hash' | 'tx' | 'address'; synthetic?: boolean }) {
  const [copied, setCopied] = useState('');
  const [full, setFull] = useState(false);
  return <span className="esc-hash"><span tabIndex={0} title={value} aria-label={`${kind}, ${value}`}>{short(value)}</span><button aria-label={`Copy ${kind} ${short(value)}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied('Copied'); } catch { setCopied('Copy unavailable. Select the full value below.'); }
  }}>Copy</button>{kind !== 'hash' && <a href={`${explorer}/${kind === 'tx' ? 'tx' : 'address'}/${value}`} target="_blank" rel="noreferrer" aria-label={`View ${synthetic ? 'placeholder ' : ''}${kind} ${short(value)} on explorer`}>↗</a>}<span className="esc-sr" role="status">{copied}</span><span className="esc-hash-full"><button aria-label={`Full ${kind}`} aria-expanded={full} onClick={() => setFull(!full)}>Full</button>{full && <code>{value}</code>}</span></span>;
}
