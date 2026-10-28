import Link from 'next/link';
export function EmptyState({ connected = false }: { connected?: boolean }) {
  return <section className="esc-empty esc-panel"><span className="esc-empty-mark" aria-hidden="true">◇</span><p className="esc-eyebrow">Ready when you are</p><h2>{connected ? 'No agreements yet.' : 'Your next agreement starts here.'}</h2><p>{connected ? 'Open the demo agreement or create one.' : 'Connect a wallet to sign and pay. You can explore the fictional demo first.'}</p><div className="esc-actions"><Link href="/agreement" className="esc-button primary">Open the demo agreement</Link><Link href={connected ? '/create' : '/connect'} className="esc-button">{connected ? 'Create an agreement' : 'Connect wallet'}</Link></div></section>;
}
