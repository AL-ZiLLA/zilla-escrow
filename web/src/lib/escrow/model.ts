import sample from '@/data/escrow/sample-agreement.json';
import states from '@/data/escrow/sample-states.json';
import { formatUnits, parseUnits } from 'viem';

export { sample, states };
export type Sample = typeof sample;
export type Role = 'client' | 'provider' | 'agent' | 'arbiter' | 'viewer';
export type Milestone = Sample['escrow']['milestones'][number];
export type Phase = Sample['scope']['phases'][number];
export type Proof = NonNullable<Milestone['proof']>;
export type AuditEvent = Sample['escrow']['audit_timeline'][number];
export type ChangeOrder = Sample['escrow']['change_orders'][number];
export type Totals = Sample['escrow']['totals'];
export type TxStatus = 'Ready' | 'Waiting for wallet' | 'Pending' | 'Confirmed' | 'Failed';
export type TxStep = { id: string; label: string; status: TxStatus; txHash?: string };
export const REVIEW_NOW = '2026-12-16T12:00:00Z';
export const DAY = 86_400_000;
export const explorer = 'https://sepolia.arbiscan.io';
export function money(value: number | bigint | string) {
  const raw = formatUnits(BigInt(value), 6);
  const [whole, fraction = ''] = raw.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0').slice(0, 2)} mUSDC`;
}
export function units(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Enter a positive amount with at most six decimals.');
  const result = parseUnits(value, 6);
  if (result > 2n ** 128n - 1n) throw new Error('Amount exceeds the contract limit.');
  return result;
}
export const short = (value: string) => value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
export function date(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
export function relative(value: string, now = REVIEW_NOW) {
  const days = Math.ceil((Date.parse(value) - Date.parse(now)) / DAY);
  return days === 0 ? 'today' : days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
export function canRelease(m: Milestone, role: Role) {
  return role === 'client' && m.status === 'Submitted' && m.funded === m.amount;
}
export function canDispute(m: Milestone, role: Role) {
  return ['client', 'provider'].includes(role) && ['Funded', 'Submitted'].includes(m.status);
}
export function canRefund(m: Milestone, role: Role, now: string) {
  return role === 'client' && ['Pending', 'Funded'].includes(m.status) && Date.parse(now) > Date.parse(m.due) + 7 * DAY;
}
export function canClaim(m: Milestone, role: Role, now: string) {
  return role === 'provider' && m.status === 'Submitted' && m.funded === m.amount && !!m.proof && Date.parse(now) >= Date.parse(m.proof.submitted_at) + 14 * DAY;
}
export function canAnswer(co: ChangeOrder, role: Role, version: number) {
  return ['client', 'provider'].includes(role) && role !== co.proposer_role && co.status === 'Proposed' && co.base_version === version;
}
export function impact(target: number | 'new', delta: bigint, due: string) {
  const m = typeof target === 'number' ? sample.escrow.milestones[target] : undefined;
  const oldEnd = sample.scope.computed_project_end;
  const afterEnd = [due, ...sample.escrow.milestones.filter(x => x.index !== target).map(x => x.due)].sort().at(-1) || due;
  return { totalBefore: BigInt(sample.escrow.totals.contract_total), totalAfter: BigInt(sample.escrow.totals.contract_total) + delta,
    milestoneBefore: BigInt(m?.amount || 0), milestoneAfter: BigInt(m?.amount || 0) + delta,
    dueBefore: m?.due, dueAfter: due, endBefore: oldEnd, endAfter: afterEnd,
    days: m ? Math.round((Date.parse(due) - Date.parse(m.due)) / DAY) : 0,
    endDays: Math.round((Date.parse(afterEnd) - Date.parse(oldEnd)) / DAY), versionBefore: 2, versionAfter: 3 };
}
export type Impact = ReturnType<typeof impact>;
