import { date, type Sample } from '@/lib/escrow/model';
export function BaselineTimeline({ data }: { data: Sample }) {
  const { scope, escrow } = data;
  const domainStart = Date.parse('2026-11-01');
  const domainSpan = Date.parse('2027-02-01') - domainStart;
  const position = (start: string, end: string) => ({ marginLeft: `${100 * (Date.parse(start)-domainStart)/domainSpan}%`, width: `${100 * (Date.parse(end)-Date.parse(start))/domainSpan}%` });
  return <section className="esc-panel"><div className="esc-section-head"><div><p className="esc-eyebrow">Signed vs current</p><h2>The plan, with every change visible.</h2></div><span className="esc-meta">- - Signed v1 &nbsp; ━ Current v{escrow.agreement.version}</span></div>
    <p className="esc-meta">Nov 1, 2026 to Feb 1, 2027 · Scroll horizontally on narrow screens to compare dates.</p><div className="esc-timeline" tabIndex={0} aria-label="Timeline. Scroll horizontally to see all phases."><div className="esc-timeline-inner"><div className="esc-timeline-months"><span>November 2026</span><span>December 2026</span><span>January 2027</span></div>{scope.phases.map((p, i) => <div className="esc-timeline-row" key={p.id}><strong>{p.code} {p.title.replace(' (added by CO-1)', '')}<span className="esc-sr">, {date(p.planned_start)} through {date(p.planned_end)}</span></strong><div className="esc-tracks"><div className="esc-track" style={position(p.planned_start,p.planned_end)}><span>{date(p.planned_end)}</span></div>{i < 3 && <div className="esc-track baseline" style={position(p.planned_start,p.planned_end)}/>} {i === 3 && <small>Added by CO-1 · +14 days</small>}</div></div>)}</div></div>
    <dl className="esc-compare"><div><dt>Signed end date · v1</dt><dd>{date(scope.signed_baseline.planned_end_date)}</dd></div><div><dt>Current end date · v2</dt><dd>{date(scope.computed_project_end)} <span className="amber">+14 days</span></dd></div></dl>
  </section>;
}
