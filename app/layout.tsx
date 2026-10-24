import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Big_Shoulders, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

// The LesWWW trio, as on leswww.com: headings, body, labels
const display = Big_Shoulders({ subsets: ["latin"], weight: "800", variable: "--display" });
const sans = Public_Sans({ subsets: ["latin"], variable: "--sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s · Liner" },
  description: SITE.description,
  applicationName: "Liner",
  authors: [{ name: "Florent Bertiaux", url: "https://www.leswww.com" }],
  creator: "Florent Bertiaux",
  publisher: "LesWWW",
  keywords: [
    "e-ink frame", "Raspberry Pi", "Inky Impression", "Spectra 6", "music discovery", "320kbps.club",
    "album art", "liner notes", "MusicBrainz", "open source", "LesWWW",
  ],
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: "Liner · LesWWW",
    title: SITE.title,
    description: SITE.description,
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Liner: an e-ink frame showing Thomas Bangalter over a blue map of France" }],
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/og.png"] },
  appleWebApp: { capable: true, title: "Liner", statusBarStyle: "default" },
  other: { "llms-txt": `${SITE.url}/llms.txt` },
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
