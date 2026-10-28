import { errors } from '@/lib/escrow/errors';
export function ErrorState({ code, message, outcome = 'Nothing was sent.', onRetry }: { code: string; message?: string; outcome?: string; onRetry?: () => void }) {
  return <section className="esc-error" role="alert"><span aria-hidden="true">!</span><div><h3>{message || errors[code] || 'The request could not be completed.'}</h3><p>{outcome}</p><small>{code}</small>{onRetry && <button className="esc-button" onClick={onRetry}>Try again</button>}</div></section>;
}
