import { getAlbumRender } from "@/lib/album";
import { isAuthConfigured } from "@/lib/auth";
import { listCrops, listDisplay } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { resolveCurrent } from "@/lib/current";
import { PANELS } from "@/lib/panels";
import { basenameWithoutExt, selectImage } from "@/lib/selection";
import { activePanel, getState } from "@/lib/state";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ScreenStatus {
  now: number;
  /** Faux quand SITE_PASSWORD n'est pas défini : le site est alors public. */
  authConfigured: boolean;
  mode: "gallery" | "album";
  imageCount: number;
  current: {
    kind: "gallery" | "album";
    label: string;
    revision: string;
    displayUrl: string;
    problem?: string;
  } | null;
  next: { label: string; previewUrl: string | null } | null;
  nextChangeAt: number | null;
  album: {
    dayKey: string;
    renderedAt: number;
    warning: string | null;
  } | null;
  pi: {
    lastSeenAt: number;
    online: boolean;
    driver: string | null;
    panelLabel: string | null;
    inSync: boolean;
    lastRefreshAt: number | null;
    lastError: string | null;
  };
  staleRender: {
    reason: string;
    bases: string[];
    affectsAlbum: boolean;
  } | null;
}

// Le Pi sonde toutes les minutes et se signale au moins toutes les 10 ;
// au-delà de 15 on le considère injoignable.
const OFFLINE_AFTER_MS = 15 * 60 * 1000;

export async function GET(): Promise<NextResponse<ScreenStatus>> {
  const [{ blobs: display }, { blobs: crops }, config, state] =
    await Promise.all([listDisplay(), listCrops(), getConfig(), getState()]);

  const now = Date.now();
  const current = await resolveCurrent(config, now);
  const detected = activePanel(state);
  const albumRender = config.mode === "album" ? await getAlbumRender() : null;

  // Les PNG pré-calculés dépendent de la dalle et de la saturation choisie :
  // si l'une des deux a changé depuis, ils doivent être recalculés.
  const panelChanged = state.panel !== null && state.renderedPanel !== detected;
  const saturationChanged = state.renderedSaturation !== config.renderSaturation;

  const cropByBase = new Map(
    crops.map((blob) => [basenameWithoutExt(blob.pathname), blob.url]),
  );

  // Ce qui sera affiché après la prochaine bascule, seulement en galerie :
  // l'album de demain dépend d'un rendu qui n'existe pas encore.
  const upcoming =
    config.mode === "gallery" && current?.nextChangeAt != null
      ? selectImage(display, config, current.nextChangeAt)
      : null;

  return NextResponse.json({
    now,
    authConfigured: isAuthConfigured(),
    mode: config.mode,
    imageCount: display.length,
    current: current
      ? {
          kind: current.kind,
          label: current.label,
          revision: current.revision,
          displayUrl: current.url,
          problem: current.problem,
        }
      : null,
    next:
      upcoming && upcoming.base !== current?.label
        ? {
            label: upcoming.base,
            previewUrl: cropByBase.get(upcoming.base) ?? null,
          }
        : null,
    nextChangeAt: current?.nextChangeAt ?? null,
    album: albumRender
      ? {
          dayKey: albumRender.dayKey,
          renderedAt: albumRender.renderedAt,
          warning: albumRender.warning,
        }
      : null,
    pi: {
      lastSeenAt: state.lastSeenAt,
      online: state.lastSeenAt > 0 && now - state.lastSeenAt < OFFLINE_AFTER_MS,
      driver: state.driver,
      panelLabel: state.panel ? PANELS[state.panel].label : null,
      inSync: current !== null && state.displayedRevision === current.revision,
      lastRefreshAt: state.lastRefreshAt,
      lastError: state.lastError,
    },
    staleRender:
      panelChanged || saturationChanged
        ? {
            reason: panelChanged
              ? `Les images ont été calculées pour une dalle ${PANELS[state.renderedPanel].label}, or le Pi rapporte une dalle ${PANELS[detected].label}. Les couleurs affichées seront fausses tant qu'elles ne sont pas recalculées.`
              : `Les images ont été calculées avec une saturation de ${state.renderedSaturation}, le réglage actuel est ${config.renderSaturation}.`,
            bases: [...cropByBase.keys()],
            // En mode album, l'image du jour est recalculée par le cron ou par
            // le bouton dédié ; seules les photos ont besoin de la boucle.
            affectsAlbum: config.mode === "album",
          }
        : null,
  });
}
