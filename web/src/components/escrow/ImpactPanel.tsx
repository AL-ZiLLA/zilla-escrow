import { date, money, type Impact } from '@/lib/escrow/model';
export function ImpactPanel({ value }: { value: Impact }) {
  return <section className="esc-panel esc-impact" aria-label="Change impact" aria-live="polite"><p className="esc-eyebrow">Before you approve</p><h2>What changes.</h2><dl>{[
    ['Contract total', money(value.totalBefore), money(value.totalAfter)],
    ['Milestone amount', money(value.milestoneBefore), money(value.milestoneAfter)],
    ['Milestone due date', value.dueBefore ? date(value.dueBefore) : 'New milestone', `${date(value.dueAfter)}${value.dueBefore ? ` · +${value.days} days` : ''}`],
    ['Project end date', date(value.endBefore), `${date(value.endAfter)} · ${value.endDays === 0 ? 'unchanged' : `+${value.endDays} days`}`],
    ['Scope version', `v${value.versionBefore}`, `v${value.versionAfter}`],
  ].map(([label, before, after]) => <div key={label}><dt>{label}</dt><dd><span>{before}</span><span aria-hidden="true">→</span><strong>{after}</strong></dd></div>)}</dl><p className="esc-notice">The signed baseline stays as it was. Added cost needs a client top-up. A submitted milestone with added cost returns to Funded and needs new proof.</p></section>;
}
