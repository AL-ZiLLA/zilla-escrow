import type { Metadata, Viewport } from 'next';

// Shared install metadata for both root layouts. Colors match tokens.css --esc-ink.
export const appleWebApp: Metadata['appleWebApp'] = { capable: true, title: 'Zilla Escrow', statusBarStyle: 'black' };
export const pwaOther: Metadata['other'] = { 'apple-mobile-web-app-capable': 'yes' };
export const themeColor: Viewport['themeColor'] = [
  { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  { media: '(prefers-color-scheme: light)', color: '#f5f3ee' },
];
