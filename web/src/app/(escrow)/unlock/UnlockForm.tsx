'use client';
import { useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  wrong: 'That password did not match. Try again.',
  config: 'The demo gate is not configured on this deployment yet.',
};

export function UnlockForm() {
  const params = useSearchParams();
  const code = params.get('error') ?? '';
  const wait = Math.min(Math.max(Number.parseInt(params.get('wait') ?? '', 10) || 15, 1), 240);
  const error = code === 'limit'
    ? `Too many attempts. Unlocking is paused for about ${wait} minute${wait === 1 ? '' : 's'}, then you can try again.`
    : MESSAGES[code];
  const next = params.get('next') ?? '/';
  return <form className="esc-form esc-panel esc-unlock-panel" method="post" action="/api/unlock">
    <input type="hidden" name="next" value={next}/>
    <label>Demo password<input type="password" name="password" autoComplete="current-password" required autoFocus aria-describedby={error ? 'unlock-error' : undefined}/></label>
    {error && <p className="esc-error-text" role="alert" id="unlock-error">! {error}</p>}
    <button className="esc-button primary" type="submit">Unlock demo</button>
    <p className="esc-meta">Stays unlocked on this device for 30 days. Test tokens only, no real value.</p>
  </form>;
}
