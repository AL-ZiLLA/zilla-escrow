import type { CSSProperties } from 'react';
export type IconName = 'overview' | 'milestone' | 'timeline' | 'change' | 'activity' | 'scope' | 'wallet' | 'proof' | 'arrow' | 'sun' | 'moon' | 'check' | 'shield' | 'plus' | 'chevron' | 'grid';
const paths: Record<IconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  milestone: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="m2 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></>,
  timeline: <><path d="M5 3v18M3 7h11M10 12h10M14 17h7"/><circle cx="14" cy="7" r="1"/></>,
  change: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  scope: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5"/></>,
  wallet: <><path d="M20 8V5H4v15h16v-5M4 5V3h13v2"/><path d="M15 9h6v6h-6zM17 12h1"/></>,
  proof: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
  shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM12 8v5M12 16h.01"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  moon: <path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  grid: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></>,
};
export function Icon({name,size=18,style}:{name:IconName;size?:number;style?:CSSProperties}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>;
}
