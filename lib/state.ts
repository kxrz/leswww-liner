import { get, put } from "@vercel/blob";
import { DEFAULT_PANEL, isPanelId, type PanelId } from "@/lib/panels";

/**
 * Ce que le Pi rapporte de lui-même. Distinct de la config : la config est
 * l'intention de l'utilisateur, cet état est la réalité observée.
 */
export interface PiState {
  /** Dernier contact, quel qu'en soit le motif. */
  lastSeenAt: number;
  /** Panneau détecté par inky.auto() sur le Pi. */
  panel: PanelId | null;
  /** Nom de classe du driver, tel quel, pour affichage et diagnostic. */
  driver: string | null;
  /** Révision effectivement affichée sur la dalle. */
  displayedRevision: string | null;
  /** Dernier rafraîchissement réel de la dalle. */
  lastRefreshAt: number | null;
  /** Dernière erreur remontée par le Pi. */
  lastError: string | null;
  /**
   * Panneau pour lequel les PNG de display/ ont été calculés. S'il diverge de
   * `panel`, les images sont dithérées vers une palette que la dalle n'affiche
   * pas et doivent être régénérées.
   */
  renderedPanel: PanelId;
  /** Saturation avec laquelle les PNG de display/ ont été calculés. */
  renderedSaturation: number;
}

export const EMPTY_STATE: PiState = {
  lastSeenAt: 0,
  panel: null,
  driver: null,
  displayedRevision: null,
  lastRefreshAt: null,
  lastError: null,
  renderedPanel: DEFAULT_PANEL,
  renderedSaturation: 1,
};

const STATE_PATH = "state/pi.json";

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getState(): Promise<PiState> {
  try {
    const result = await get(STATE_PATH, { access: "public" });

    if (!result) {
      return EMPTY_STATE;
    }

    const parsed: unknown = JSON.parse(
      await new Response(result.stream).text(),
    );

    if (!parsed || typeof parsed !== "object") {
      return EMPTY_STATE;
    }

    const obj = parsed as Record<string, unknown>;

    return {
      lastSeenAt: numberOrNull(obj.lastSeenAt) ?? 0,
      panel: isPanelId(obj.panel) ? obj.panel : null,
      driver: stringOrNull(obj.driver),
      displayedRevision: stringOrNull(obj.displayedRevision),
      lastRefreshAt: numberOrNull(obj.lastRefreshAt),
      lastError: stringOrNull(obj.lastError),
      renderedPanel: isPanelId(obj.renderedPanel)
        ? obj.renderedPanel
        : DEFAULT_PANEL,
      renderedSaturation: numberOrNull(obj.renderedSaturation) ?? 1,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: PiState): Promise<void> {
  await put(STATE_PATH, JSON.stringify(state), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Palette à utiliser pour dithérer : celle de la dalle réellement détectée. */
export function activePanel(state: PiState): PanelId {
  return state.panel ?? DEFAULT_PANEL;
}
