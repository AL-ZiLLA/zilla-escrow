import type { Metadata, Viewport } from 'next';
import { Anton, Geist } from 'next/font/google';
import { DemoProvider } from '@/lib/escrow/DemoProvider';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';
import { appleWebApp, pwaOther, themeColor } from '@/lib/pwa';
import '../globals.css';
import '../refinement.css';
const display = Anton({weight:'400',subsets:['latin'],variable:'--font-anton'});
const sans = Geist({subsets:['latin'],variable:'--font-geist'});
export const metadata: Metadata = {title:'Zilla Escrow | UI review',description:'Milestone escrow for service work. Fictional testnet UI preview. Demo. Not audited.',robots:{index:false,follow:false},applicationName:'Zilla Escrow',appleWebApp,other:pwaOther};
export const viewport: Viewport = {themeColor,width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}><head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('zilla-escrow-theme')==='light'?'light':'dark'}catch(e){}"}}/></head><body><DemoProvider>{children}</DemoProvider><RegisterServiceWorker/></body></html>;
}
