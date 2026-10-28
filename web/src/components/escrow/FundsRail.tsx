import {money,type Totals} from '@/lib/escrow/model';
export function FundsRail({totals}:{totals:Totals}) {
  const values=[['Released',totals.released,'paid'],['In escrow',totals.escrow_balance,'held'],['Still to fund',totals.unfunded,'owed'],...(totals.refunded?[['Returned',totals.refunded,'returned']]:[])] as [string,number,string][];
  return <section className="esc-funds-rail" aria-label="How the agreement funds are allocated"><div className="esc-funds-rail-heading"><span className="esc-label">One agreement. Every payment accounted for.</span><span className="esc-meta">{money(totals.contract_total)} total</span></div><div className="esc-allocation" aria-hidden="true">{values.map(([label,value,kind])=><span key={label} className={kind} style={{width:`${100*value/totals.contract_total}%`}}/>)}</div><ul>{values.map(([label,value,kind])=><li key={label}><i className={kind} aria-hidden="true"/>{label}<strong>{money(value)}</strong></li>)}</ul></section>;
}
