"use client";

import { LibraryIcon, ScreenIcon, SettingsIcon } from "@/components/Icons";
import { useState, type ReactNode } from "react";

type TabId = "ecran" | "bibliotheque" | "reglages";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "ecran", label: "Écran", icon: <ScreenIcon /> },
  { id: "bibliotheque", label: "Bibliothèque", icon: <LibraryIcon /> },
  { id: "reglages", label: "Réglages", icon: <SettingsIcon /> },
];

type Props = {
  ecran: ReactNode;
  bibliotheque: ReactNode;
  reglages: ReactNode;
  commit: string;
};

export default function AppShell({
  ecran,
  bibliotheque,
  reglages,
  commit,
}: Props) {
  const [active, setActive] = useState<TabId>("ecran");

  const panels: Record<TabId, ReactNode> = {
    ecran,
    bibliotheque,
    reglages,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
      <header className="border-b border-line py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-bg-subtle">
            <ScreenIcon className="h-5 w-5 stroke-fg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">tekpi</h1>
            <p className="text-sm text-fg-muted">
              Pilotage du cadre e-ink. Les réglages sont appliqués en ligne, le
              Pi vient chercher les changements.
            </p>
          </div>
        </div>
      </header>

      <nav
        className="sticky top-3 z-20 my-6 inline-flex flex-wrap gap-0.5 rounded-lg bg-bg-muted p-1"
        aria-label="Sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            aria-current={active === tab.id ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-current ${
              active === tab.id
                ? "bg-bg text-fg shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {TABS.map((tab) => (
          <div key={tab.id} hidden={active !== tab.id}>
            {panels[tab.id]}
          </div>
        ))}
      </main>

      <footer className="mt-14 border-t border-line pt-4">
        <p className="font-mono text-xs text-fg-faint">{commit}</p>
      </footer>
    </div>
  );
}
