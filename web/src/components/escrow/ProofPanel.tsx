import { money, date, relative, type Milestone, type Phase } from '@/lib/escrow/model';
import { HashValue } from './HashValue';
export function ProofPanel({ milestone, phase, agent, verified, onVerify }: { milestone: Milestone; phase: Phase; agent: string; verified: boolean | null; onVerify: () => void }) {
  const proof = milestone.proof;
  if (!proof) return <section className="esc-panel"><h2>No proof submitted yet</h2><p>The provider or assigned agent can submit after this milestone is fully funded.</p></section>;
  const end = new Date(Date.parse(proof.submitted_at) + 14 * 86400000).toISOString();
  return <section className="esc-panel"><p className="esc-eyebrow">Delivery evidence · {milestone.label}</p><h2>See the work before you release.</h2><p>Submitted by Zilla OS delivery agent</p><HashValue value={agent} kind="address"/><p className="esc-meta">{date(proof.submitted_at)} · {relative(proof.submitted_at)}</p>
    <ul className="esc-proof-items">{phase.deliverables.map(d => <li key={d.id}><span className="green" aria-hidden="true">✓</span><div><strong>{d.label}</strong><small>Agent marked delivered · client review required</small></div></li>)}</ul>
    <p className="esc-label">Acceptance criteria</p><ul>{phase.acceptance_criteria.map(c => <li key={c}>{c}</li>)}</ul>
    <div className="esc-inset"><p className="esc-label">Proof pack</p><code>{proof.proof_uri}</code><p className="esc-meta">Synthetic URI. Files are not hosted in this preview.</p><HashValue value={proof.proof_hash}/><div className="esc-actions"><button className="esc-button" onClick={onVerify}>Check proof fingerprint</button><span role="status">{verified === false ? 'Not verified. The synthetic pack cannot be fetched.' : verified === true ? 'Fingerprint matches the fetched pack.' : 'Not checked'}</span></div></div>
    <p className="esc-notice">{milestone.status === 'Released' ? 'This milestone was released. Its review window no longer applies.' : <>Review {money(milestone.amount)} by {date(end)} · {relative(end)}. Release or dispute before then. After 14 days, the provider may claim payment with a transaction.</>}</p>
    <details><summary>Earlier proofs</summary><p>No earlier submission is included in this fixture. In the integrated app, rebuild proof history from ProofSubmitted events. Resubmitting replaces the proof and restarts the review window.</p></details>
  </section>;
}
