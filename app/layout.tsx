import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tekpi",
  description: "Pilotage de l'écran e-ink",
  // Troisième barrière, pour les robots qui lisent la page sans avoir
  // consulté robots.txt ni regardé les en-têtes.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
