import { money, type Totals } from '@/lib/escrow/model';
import {Icon,type IconName} from './Icon';
export function MoneySummary({ totals }: { totals: Totals }) {
  const icons:IconName[]=['scope','wallet','check','timeline'];
  return <dl className="esc-money">{[
    ['Contract total', totals.contract_total, 'Signed scope + approved changes'],
    ['In escrow now', totals.escrow_balance, 'Held for unfinished milestones'],
    ['Released to provider', totals.released, 'Paid for accepted work'],
    ['Still to fund', totals.unfunded, 'Agreed, not in escrow yet'],
  ].map(([label, value, hint], i) => <div key={label} className={i === 1 ? 'esc-money-held' : ''}><dt>{label}<Icon name={icons[i]} size={14}/></dt><dd><span className="esc-metric-value">{money(value).replace(' mUSDC','')}</span>{' '}<span className="esc-metric-unit">mUSDC</span><small>{hint}</small></dd></div>)}</dl>;
}
