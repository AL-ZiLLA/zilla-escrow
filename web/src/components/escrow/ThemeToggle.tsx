'use client';
import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';
type Theme = 'dark' | 'light';
const key = 'zilla-escrow-theme';
function current(): Theme { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key) { document.documentElement.setAttribute('data-theme',event.newValue === 'light' ? 'light' : 'dark'); notify(); }
  };
  window.addEventListener('zilla-theme',notify);
  window.addEventListener('storage',storage);
  return () => {window.removeEventListener('zilla-theme',notify);window.removeEventListener('storage',storage);};
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe,current,()=>'dark' as Theme);
  function choose(value:Theme) {
    document.documentElement.setAttribute('data-theme',value);
    try {localStorage.setItem(key,value);} catch { /* In-memory switching still works when storage is unavailable. */ }
    window.dispatchEvent(new Event('zilla-theme'));
  }
  return <div className="esc-theme-switch" role="group" aria-label="Color theme">{(['dark','light'] as const).map(value => <button key={value} aria-label={`Use ${value} theme`} aria-pressed={theme===value} onClick={()=>choose(value)}><Icon name={value==='dark'?'moon':'sun'} size={15}/><span>{value==='dark'?'Dark':'Light'}</span></button>)}</div>;
}
