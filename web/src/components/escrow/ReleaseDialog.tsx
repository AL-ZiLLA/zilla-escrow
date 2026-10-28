'use client';
import { useEffect, useRef } from 'react';
import { money, type Milestone, type Phase } from '@/lib/escrow/model';
import { HashValue } from './HashValue';
import { TestnetBadge } from './TestnetBadge';
export function ReleaseDialog({ open, milestone, phase, provider, providerName, busy, onClose, onRelease }: { open: boolean; milestone: Milestone; phase: Phase; provider: string; providerName: string; busy: boolean; onClose: () => void; onRelease: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) { ref.current?.showModal(); ref.current?.scrollTo({ top: 0 }); } else if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return <dialog ref={ref} className="esc-dialog" aria-labelledby="release-title" onCancel={onClose} onClose={onClose} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const targets = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]');
    if (!targets?.length) return;
    const first = targets[0], last = targets[targets.length - 1];
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  }}><TestnetBadge/><p className="esc-eyebrow">Client approval gate</p><h2 id="release-title">Release this payment?</h2><p>{milestone.label}</p><strong className="esc-big-money">{money(milestone.amount)}</strong><p>To {providerName}</p><HashValue value={provider} kind="address"/><p className="esc-label">You are accepting</p><ul>{phase.deliverables.map(d => <li key={d.id}>{d.label}</li>)}</ul>{milestone.proof && <HashValue value={milestone.proof.proof_hash}/>}<p className="esc-notice">This is final. Released funds cannot be pulled back.</p><p className="esc-meta">Before release, you can dispute. The provider may claim 14 days after proof. Undelivered funds have a 7-day grace period after the due date.</p><div className="esc-actions"><button autoFocus className="esc-button" onClick={onClose}>Keep reviewing</button><button className="esc-button primary" disabled={busy} onClick={onRelease}>Release {money(milestone.amount)}</button></div></dialog>;
}
