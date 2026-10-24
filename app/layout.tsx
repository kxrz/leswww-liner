import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

// The LesWWW trio, as on leswww.com: headings, body, labels
const display = Big_Shoulders({ subsets: ["latin"], weight: "800", variable: "--display" });
const sans = Public_Sans({ subsets: ["latin"], variable: "--sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--mono" });

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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
