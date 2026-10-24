import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// The LesWWW type system, as on leswww.com
const sans = Geist({ subsets: ["latin"], variable: "--sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--mono" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--display" });

export const metadata: Metadata = {
  metadataBase: new URL("https://liner.leswww.com"),
  title: "Liner · one track on the wall · a LesWWW project",
  description:
    "Liner is an e-ink frame that hangs one track from 320kbps.club at a time: the cover and its liner notes on a museum label, over a map of where the artist comes from. A LesWWW project.",
  openGraph: { images: ["/og.png"] },
  appleWebApp: { capable: true, title: "Liner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
