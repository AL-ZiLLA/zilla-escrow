import { date, money, sample, type AuditEvent, type Role } from '@/lib/escrow/model';
import { HashValue } from './HashValue';
export function AuditRow({ event: e }: { event: AuditEvent }) {
  const m = e.milestone_index !== undefined ? sample.escrow.milestones[e.milestone_index] : undefined;
  const verb: Record<string, string> = {MilestoneFunded:'Client funded', MilestoneReleased:'Client released payment for', ProofSubmitted:'Agent submitted proof for'};
  const text = e.summary || `${verb[e.event] || e.event.replace(/([a-z])([A-Z])/g, '$1 $2')} ${m?.label || `CO-${(e.change_order_id ?? 0) + 1}`}${e.amount ? `: ${money(e.amount)}` : ''}`;
  const address = sample.escrow.agreement[e.actor_role as Exclude<Role, 'viewer'>];
  const hash = e.scope_hash || e.baseline_hash || e.proof_hash;
  return <li className="esc-audit-row"><span className="esc-audit-icon" aria-hidden="true">{e.event.includes('Funded') || e.event.includes('Released') ? '↗' : e.event.includes('Proof') ? '✓' : '◇'}</span><div><h3>{text}</h3><p className="esc-meta">{date(e.block_time)} · {new Date(e.block_time).toISOString().slice(11,16)} UTC · {e.actor_role}</p>{address && <HashValue value={address} kind="address"/>}{hash && <p className="esc-meta">Document fingerprint <HashValue value={hash}/></p>}</div><div><p className="esc-meta">Placeholder transaction</p><HashValue value={e.tx_hash} kind="tx"/></div></li>;
}
