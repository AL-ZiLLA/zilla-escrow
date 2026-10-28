import Link from 'next/link';
import { money, date, relative, type Milestone, type Phase, type Role, canRelease } from '@/lib/escrow/model';
import { StatusChip } from './StatusChip';
import { HashValue } from './HashValue';
export function MilestoneCard({ milestone: m, phase, role, moneyTx }: { milestone: Milestone; phase: Phase; role: Role; moneyTx?: string }) {
  const order = ['Pending', 'Funded', 'Submitted', 'Released'];
  const progress = order.indexOf(m.status);
  return <article className={`esc-milestone ${m.status === 'Submitted' ? 'review' : ''}`}><div className="esc-milestone-head"><span className="esc-phase">{phase.code}</span><div><h3>{m.label.replace(/^P\d\s/, '')}</h3><p className="esc-meta">Due {date(m.due)} · {relative(m.due)}</p></div><StatusChip status={m.status} detail={m.status === 'Submitted' && role === 'client' ? 'Needs your review' : undefined}/><strong className="esc-amount">{money(m.amount)}</strong></div>
    <div className="esc-milestone-body"><div><p className="esc-label">This payment covers</p><ul className="esc-inline-list">{phase.deliverables.map(d => <li key={d.id}>{d.label}</li>)}</ul><p className="esc-meta">In escrow: {money(m.funded)}{m.released > 0 && ` · Released: ${money(m.released)}`}</p></div><div className="esc-milestone-action">{canRelease(m, role) && <Link className="esc-button" href={m.index===0?'/proof/p1':'/proof'}>Review proof →</Link>}{m.status === 'Pending' && role === 'client' && <Link className="esc-button" href="/fund">Fund milestone →</Link>}{m.proof && <Link className="esc-text-link" href={m.index===0?'/proof/p1':'/proof'}>View proof pack ↗</Link>}</div></div>
    {progress >= 0 && <ol className="esc-progress" aria-label={`${m.label}: ${m.status}`}>{order.map((s, i) => <li key={s} className={i <= progress ? 'reached' : ''}><span aria-hidden="true">{i < progress ? '✓' : '○'}</span> {s}</li>)}</ol>}
    {moneyTx && <details className="esc-milestone-receipt"><summary>View {m.status === 'Released' ? 'release' : 'funding'} record <span>↗</span></summary><p className="esc-meta">Placeholder transaction <HashValue value={moneyTx} kind="tx"/></p></details>}
  </article>;
}
