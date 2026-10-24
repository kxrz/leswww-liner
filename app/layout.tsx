import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--mono" });

export const metadata: Metadata = {
  title: "Cadre",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Cadre", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f4f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
