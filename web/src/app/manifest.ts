import type { MetadataRoute } from 'next';

// Colors come from tokens.css: --esc-ink (dark, the default theme). The light theme's
// browser chrome color is set per color scheme in each layout's viewport.themeColor.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Zilla Escrow',
    short_name: 'Zilla Escrow',
    description: 'Milestone escrow for service work. Testnet demo on Arbitrum Sepolia. Not audited.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
