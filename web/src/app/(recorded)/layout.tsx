import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { appleWebApp, pwaOther, themeColor } from "@/lib/pwa";
import "./recorded.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Zilla Escrow | Recorded Arbitrum Sepolia run",
  description:
    "Testnet demo. Clients fund each phase, delivery agents post proof, clients release with one click. Built by Zilla Labs on Arbitrum.",
  robots: { index: false, follow: false },
  applicationName: "Zilla Escrow",
  appleWebApp,
  other: pwaOther,
};

export const viewport: Viewport = { themeColor };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}<RegisterServiceWorker /></body>
    </html>
  );
}
