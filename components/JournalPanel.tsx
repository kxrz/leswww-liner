"use client";

import { RefreshIcon } from "@/components/Icons";
import type { JournalEntry } from "@/lib/journal";
import { useCallback, useState } from "react";

function formatStamp(at: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(at));
}

const LEVEL_STYLE: Record<JournalEntry["level"], string> = {
  info: "badge-secondary",
  warn: "bg-amber-100 text-amber-900",
  error: "bg-red-100 text-red-900",
};

/**
 * Journal replié par défaut et chargé à la demande : il n'a pas besoin d'être
 * rapatrié à chaque sondage de l'état de l'écran.
 */
export default function JournalPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/journal", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Journal indisponible.");
      }
      const data = (await response.json()) as { entries: JournalEntry[] };
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      void load();
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="field-label">Journal</p>
          <p className="sect-sub mt-1">
            Ce que le Pi et le serveur ont fait récemment.
          </p>
        </div>
        <div className="flex gap-2">
          {open ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshIcon />
              {loading ? "Chargement…" : "Actualiser"}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={handleToggle}>
            {open ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4">
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {entries !== null && entries.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Aucun événement pour le moment. Le Pi remplira ce journal à son
              prochain contact.
            </p>
          ) : null}

          {entries !== null && entries.length > 0 ? (
            <ul className="divide-y divide-line">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-fg-faint">
                    {formatStamp(entry.at)}
                  </span>
                  <span className={`badge ${LEVEL_STYLE[entry.level]}`}>
                    {entry.source}
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    {entry.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {entries === null && !error ? (
            <p className="text-sm text-fg-muted">Chargement…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
