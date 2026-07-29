"use client";

import type { ScreenStatus } from "@/app/api/status/route";
import { AlertIcon, CheckIcon, RefreshIcon } from "@/components/Icons";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const POLL_MS = 15000;

function formatDelay(ms: number): string {
  if (ms < 0) {
    ms = 0;
  }

  const minutes = Math.round(ms / 60000);

  if (minutes < 1) {
    return "moins d'une minute";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function formatAgo(timestamp: number, now: number): string {
  if (!timestamp) {
    return "jamais";
  }
  return `il y a ${formatDelay(now - timestamp)}`;
}

export default function ScreenPanel() {
  const [status, setStatus] = useState<ScreenStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [forcing, setForcing] = useState(false);
  const [regen, setRegen] = useState<{ done: number; total: number } | null>(
    null,
  );

  // Bousculer cette clé relance immédiatement le sondage et réarme le
  // minuteur, ce qui est exactement ce qu'on veut après une action manuelle.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("statut indisponible");
        }
        const data = (await response.json()) as ScreenStatus;
        if (!cancelled) {
          setStatus(data);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      }
    };

    void fetchStatus();
    const poll = setInterval(() => void fetchStatus(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [reloadKey]);

  async function handleForce() {
    setForcing(true);
    try {
      await fetch("/api/force-refresh", { method: "POST" });
      reload();
    } finally {
      setForcing(false);
    }
  }

  async function handleRegenerate(bases: string[]) {
    setRegen({ done: 0, total: bases.length });

    for (let i = 0; i < bases.length; i++) {
      await fetch("/api/redither", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base: bases[i] }),
      });
      setRegen({ done: i + 1, total: bases.length });
    }

    await fetch("/api/redither", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalize: true }),
    });

    setRegen(null);
    reload();
  }

  if (!status) {
    return (
      <div className="card p-6">
        <p className="text-sm text-fg-muted">
          {loadFailed ? "Statut indisponible." : "Chargement…"}
        </p>
      </div>
    );
  }

  const { pi, current, next, nextChangeAt, staleRender } = status;

  return (
    <div className="flex flex-col gap-4">
      {staleRender ? (
        <div className="card border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0 stroke-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Les images doivent être recalculées
              </p>
              <p className="mt-1 text-sm text-amber-800">{staleRender.reason}</p>
              <button
                type="button"
                className="btn btn-ghost mt-3"
                disabled={regen !== null}
                onClick={() => void handleRegenerate(staleRender.bases)}
              >
                <RefreshIcon />
                {regen
                  ? `Recalcul ${regen.done}/${regen.total}…`
                  : `Recalculer ${staleRender.bases.length} image${
                      staleRender.bases.length > 1 ? "s" : ""
                    }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                pi.online ? "bg-ok" : "bg-fg-faint"
              }`}
            />
            <span className="text-sm font-medium">
              {pi.online ? "Pi connecté" : "Pi injoignable"}
            </span>
            <span className="text-sm text-fg-muted">
              · vu {formatAgo(pi.lastSeenAt, now)}
            </span>
          </div>

          <span
            className={`badge ${pi.inSync ? "badge-secondary" : "badge-solid"}`}
          >
            {pi.inSync ? (
              <>
                <CheckIcon className="h-3 w-3" />À jour
              </>
            ) : (
              "Changement en attente"
            )}
          </span>
        </div>

        {current ? (
          <div className="relative aspect-[5/3] w-full bg-bg-muted">
            <Image
              key={current.revision}
              src={`${current.displayUrl}?r=${current.revision}`}
              alt={current.base}
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 720px"
            />
          </div>
        ) : (
          <div className="flex aspect-[5/3] items-center justify-center bg-bg-subtle">
            <p className="text-sm text-fg-muted">
              Aucune image cadrée à afficher.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="text-sm">
            <p className="text-fg-muted">
              {nextChangeAt
                ? `Change dans ${formatDelay(nextChangeAt - now)}`
                : "Image épinglée, pas de rotation"}
              {next ? (
                <>
                  {" · ensuite "}
                  <span className="text-fg">{next.base}</span>
                </>
              ) : null}
            </p>
            {pi.lastError ? (
              <p className="mt-1 text-danger">Dernière erreur : {pi.lastError}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={forcing || !current}
            onClick={() => void handleForce()}
          >
            <RefreshIcon />
            {forcing ? "Envoi…" : "Afficher maintenant"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <p className="field-label">Matériel</p>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Dalle détectée</dt>
            <dd className="text-right">{pi.panelLabel ?? "en attente du Pi"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Driver</dt>
            <dd className="text-right font-mono text-xs">
              {pi.driver ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Dernier rafraîchissement</dt>
            <dd className="text-right">
              {pi.lastRefreshAt ? formatAgo(pi.lastRefreshAt, now) : "jamais"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Images disponibles</dt>
            <dd className="text-right">{status.imageCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
