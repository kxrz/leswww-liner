import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--mono" });

export const metadata: Metadata = {
  title: "Liner · 320kbps.club",
  description: "An e-ink frame that hangs one track at a time from 320kbps.club.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Liner", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f4f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
