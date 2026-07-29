import { listCrops, listDisplay } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { PANELS } from "@/lib/panels";
import { basenameWithoutExt, selectImage } from "@/lib/selection";
import { activePanel, getState } from "@/lib/state";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ScreenStatus {
  now: number;
  imageCount: number;
  current: {
    base: string;
    revision: string;
    displayUrl: string;
    cropUrl: string | null;
  } | null;
  next: { base: string; cropUrl: string | null } | null;
  nextChangeAt: number | null;
  pi: {
    lastSeenAt: number;
    online: boolean;
    driver: string | null;
    panelLabel: string | null;
    inSync: boolean;
    lastRefreshAt: number | null;
    lastError: string | null;
  };
  /** Les PNG de display/ ne correspondent plus aux réglages courants. */
  staleRender: { reason: string; bases: string[] } | null;
}

// Le Pi sonde toutes les minutes et se signale au moins toutes les 10 ;
// au-delà de 15 on le considère injoignable.
const OFFLINE_AFTER_MS = 15 * 60 * 1000;

export async function GET(): Promise<NextResponse<ScreenStatus>> {
  const [{ blobs: display }, { blobs: crops }, config, state] =
    await Promise.all([listDisplay(), listCrops(), getConfig(), getState()]);

  const now = Date.now();
  const current = selectImage(display, config, now);
  const detected = activePanel(state);

  // Les PNG pré-calculés dépendent de la dalle et de la saturation choisie :
  // si l'une des deux a changé depuis, ils doivent être recalculés.
  const panelChanged = state.panel !== null && state.renderedPanel !== detected;
  const saturationChanged = state.renderedSaturation !== config.renderSaturation;

  const cropByBase = new Map(
    crops.map((blob) => [basenameWithoutExt(blob.pathname), blob.url]),
  );

  // Ce qui sera affiché après la prochaine bascule, pour donner un « ensuite ».
  const next =
    current?.nextChangeAt != null
      ? selectImage(display, config, current.nextChangeAt)
      : null;

  return NextResponse.json({
    now,
    imageCount: display.length,
    current: current
      ? {
          base: current.base,
          revision: current.revision,
          displayUrl: current.url,
          cropUrl: cropByBase.get(current.base) ?? null,
        }
      : null,
    next:
      next && next.base !== current?.base
        ? { base: next.base, cropUrl: cropByBase.get(next.base) ?? null }
        : null,
    nextChangeAt: current?.nextChangeAt ?? null,
    pi: {
      lastSeenAt: state.lastSeenAt,
      online: state.lastSeenAt > 0 && now - state.lastSeenAt < OFFLINE_AFTER_MS,
      driver: state.driver,
      panelLabel: state.panel ? PANELS[state.panel].label : null,
      inSync:
        current !== null && state.displayedRevision === current.revision,
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
          }
        : null,
  });
}
