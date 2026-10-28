const tones: Record<string, string> = {
  Active: 'green', Released: 'green', Approved: 'green', Confirmed: 'green', Verified: 'green',
  Funded: 'cyan', Pending: 'dim', Submitted: 'amber', Proposed: 'amber', 'Waiting for wallet': 'amber',
  Disputed: 'error', Stale: 'error', Failed: 'error', Refunded: 'dim', Resolved: 'dim', Cancelled: 'dim',
  Declined: 'dim', Withdrawn: 'dim', 'In progress': 'cyan',
};
export function StatusChip({ status, detail }: { status: string; detail?: string }) {
  return <span className={`esc-chip ${tones[status] || 'dim'}`}><span aria-hidden="true">{status === 'Disputed' ? '⊠' : status === 'Refunded' ? '↩' : status === 'Stale' || status === 'Failed' ? '!' : '●'}</span> {status}{detail && ` · ${detail}`}</span>;
}
