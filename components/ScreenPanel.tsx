"use client";

import type { ScreenStatus } from "@/app/api/status/route";
import { AlertIcon, CheckIcon, RefreshIcon } from "@/components/Icons";
import JournalPanel from "@/components/JournalPanel";
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
  const [rebuilding, setRebuilding] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
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

    // Un onglet oublié en arrière-plan interrogeait /api/status toutes les
    // 15 s indéfiniment, soit plusieurs milliers d'opérations Blob par jour
    // pour personne. On ne sonde que quand la page est visible, et on
    // rattrape immédiatement au retour.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchStatus();
      }
    };

    void fetchStatus();
    const poll = setInterval(onVisible, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
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

  async function handleRebuildAlbum() {
    setRebuilding(true);
    setAlbumError(null);
    try {
      const response = await fetch("/api/album/refresh", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Échec du calcul.");
      }
      reload();
    } catch (err) {
      setAlbumError(err instanceof Error ? err.message : "Échec du calcul.");
    } finally {
      setRebuilding(false);
    }
  }

  async function handleRegenerate(bases: string[]) {
    setRegen({ done: 0, total: bases.length });
    setAlbumError(null);
    const failed: string[] = [];

    for (let i = 0; i < bases.length; i++) {
      try {
        const response = await fetch("/api/redither", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base: bases[i] }),
        });
        if (!response.ok) {
          failed.push(bases[i]);
        }
      } catch {
        failed.push(bases[i]);
      }
      setRegen({ done: i + 1, total: bases.length });
    }

    // Ne finaliser que si tout est passé : marquer l'état comme à jour alors
    // que des images sont restées fausses ferait disparaître l'avertissement
    // sans que le problème soit résolu.
    if (failed.length === 0) {
      await fetch("/api/redither", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: true }),
      });
    } else {
      setAlbumError(
        `${failed.length} image${failed.length > 1 ? "s" : ""} sur ${bases.length} n'${
          failed.length > 1 ? "ont" : "a"
        } pas pu être recalculée${failed.length > 1 ? "s" : ""}. L'avertissement reste affiché.`,
      );
    }

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

  const { pi, current, next, nextChangeAt, staleRender, album, mode } = status;
  const { authConfigured } = status;

  // Rythme d'usure observé, plus parlant qu'un total brut.
  const days = pi.firstSeenAt
    ? Math.max(1, (now - pi.firstSeenAt) / 86400000)
    : null;
  const perDay = days ? (pi.refreshCount / days).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-4">
      {!authConfigured ? (
        <div className="card border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0 stroke-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Ce site est accessible à tout le monde
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Sans <code className="font-mono text-xs">SITE_PASSWORD</code>{" "}
                dans les variables d&apos;environnement, n&apos;importe qui
                connaissant l&apos;adresse peut envoyer une image sur ton mur ou
                vider la galerie. Définis-le sur Vercel, puis redéploie.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {staleRender ? (
        <div className="card border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 flex-shrink-0 stroke-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Les images doivent être recalculées
              </p>
              <p className="mt-1 text-sm text-amber-800">{staleRender.reason}</p>
              {staleRender.affectsAlbum ? (
                <p className="mt-1 text-sm text-amber-800">
                  L&apos;album du jour est concerné lui aussi : utilise
                  « Recalculer l&apos;album » ci-dessous.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost mt-3"
                disabled={regen !== null || staleRender.bases.length === 0}
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

        {current && current.displayUrl ? (
          <div className="relative aspect-[5/3] w-full bg-bg-muted">
            <Image
              key={current.revision}
              src={`${current.displayUrl}?r=${current.revision}`}
              alt={current.label}
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 720px"
            />
          </div>
        ) : (
          <div className="flex aspect-[5/3] items-center justify-center bg-bg-subtle px-6 text-center">
            <p className="text-sm text-fg-muted">
              {current?.problem ?? "Aucune image cadrée à afficher."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="text-sm">
            {current ? (
              <p className="font-medium">{current.label}</p>
            ) : null}
            <p className="text-fg-muted">
              {nextChangeAt
                ? `Change dans ${formatDelay(nextChangeAt - now)}`
                : mode === "album"
                  ? "En attente du calcul quotidien"
                  : "Image épinglée, pas de rotation"}
              {next ? (
                <>
                  {" · ensuite "}
                  <span className="text-fg">{next.label}</span>
                </>
              ) : null}
            </p>
            {album?.warning ? (
              <p className="mt-1 text-amber-700">
                Spotify injoignable, catalogue en cache : {album.warning}
              </p>
            ) : null}
            {current?.problem && current.displayUrl ? (
              <p className="mt-1 text-amber-700">{current.problem}</p>
            ) : null}
            {albumError ? (
              <p className="mt-1 text-danger">{albumError}</p>
            ) : null}
            {pi.lastError ? (
              <p className="mt-1 text-danger">Dernière erreur : {pi.lastError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "album" ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rebuilding}
                onClick={() => void handleRebuildAlbum()}
              >
                <RefreshIcon />
                {rebuilding ? "Calcul…" : "Recalculer l'album"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={forcing || !current?.displayUrl}
              onClick={() => void handleForce()}
            >
              <RefreshIcon />
              {forcing ? "Envoi…" : "Afficher maintenant"}
            </button>
          </div>
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
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Cadence de sondage</dt>
            <dd className="text-right">
              {status.pollMinutes === 1
                ? "chaque minute"
                : `toutes les ${status.pollMinutes} min`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Cycles de la dalle</dt>
            <dd className="text-right">
              {pi.refreshCount}
              {pi.firstSeenAt ? (
                <span className="text-fg-muted">
                  {" "}
                  · {perDay} / jour
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="sect-sub mt-3">
          Une dalle e-ink a un nombre de cycles fini. Espacer les
          rafraîchissements coûte peu et prolonge le matériel : le délai de
          garde et l&apos;intervalle de rotation se règlent dans Réglages.
        </p>
      </div>

      <JournalPanel />
    </div>
  );
}
