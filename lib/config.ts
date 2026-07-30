import { get, put } from "@vercel/blob";

export type DisplayMode = "gallery" | "album";
export type RotationMode = "sequential" | "random" | "fixed";

export interface AppConfig {
  mode: DisplayMode;
  /** URL, URI ou identifiant d'une playlist Spotify publique. */
  spotifyPlaylist: string | null;
  rotation: RotationMode;
  fixedImage: string | null;
  intervalHours: 1 | 2 | 4 | 8 | 24;
  /**
   * Délai minimal entre deux rafraîchissements réels de la dalle. Un cycle
   * ACeP dure 20 à 35 s et Pimoroni recommande d'espacer les rafraîchissements
   * complets ; un aller-retour dans les réglages ne doit pas faire clignoter
   * l'écran en boucle. Contourné par « Afficher maintenant ».
   */
  minRefreshMinutes: 0 | 5 | 15 | 30 | 60;
  /**
   * Intervalle entre deux sondages du Pi. Le cron tourne à la minute, mais le
   * script s'arrête aussitôt si le dernier contact est plus récent que cette
   * valeur : la cadence se règle donc depuis le site, sans toucher au crontab.
   */
  pollMinutes: 1 | 5 | 15 | 30;
  /**
   * Saturation appliquée avant dithering. 1.0 est le rendu le plus fidèle
   * (mesuré en ΔE) ; Pimoroni conseille de monter quand le résultat paraît
   * terne sur la dalle. C'est un réglage de goût, à juger sur l'aperçu.
   */
  renderSaturation: 1 | 1.15 | 1.3;
  /** Horodatage du dernier « Afficher maintenant » déclenché depuis le site. */
  forceRefreshAt: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  mode: "gallery",
  spotifyPlaylist: null,
  rotation: "sequential",
  fixedImage: null,
  intervalHours: 4,
  minRefreshMinutes: 15,
  pollMinutes: 5,
  renderSaturation: 1,
  forceRefreshAt: 0,
};

const CONFIG_PATH = "config/settings.json";

const INTERVAL_HOURS: AppConfig["intervalHours"][] = [1, 2, 4, 8, 24];
const MIN_REFRESH: AppConfig["minRefreshMinutes"][] = [0, 5, 15, 30, 60];
const POLL_MINUTES: AppConfig["pollMinutes"][] = [1, 5, 15, 30];
const SATURATIONS: AppConfig["renderSaturation"][] = [1, 1.15, 1.3];
const ROTATION_MODES: RotationMode[] = ["sequential", "random", "fixed"];
const MODES: DisplayMode[] = ["gallery", "album"];

function isRotation(value: unknown): value is RotationMode {
  return ROTATION_MODES.includes(value as RotationMode);
}

function isInterval(value: unknown): value is AppConfig["intervalHours"] {
  return INTERVAL_HOURS.includes(value as AppConfig["intervalHours"]);
}

function isMinRefresh(value: unknown): value is AppConfig["minRefreshMinutes"] {
  return MIN_REFRESH.includes(value as AppConfig["minRefreshMinutes"]);
}

function isPollMinutes(value: unknown): value is AppConfig["pollMinutes"] {
  return POLL_MINUTES.includes(value as AppConfig["pollMinutes"]);
}

function isSaturation(value: unknown): value is AppConfig["renderSaturation"] {
  return SATURATIONS.includes(value as AppConfig["renderSaturation"]);
}

function mergeConfig(partial: unknown): AppConfig {
  if (!partial || typeof partial !== "object") {
    return DEFAULT_CONFIG;
  }

  const obj = partial as Record<string, unknown>;

  return {
    mode: MODES.includes(obj.mode as DisplayMode)
      ? (obj.mode as DisplayMode)
      : DEFAULT_CONFIG.mode,
    spotifyPlaylist:
      typeof obj.spotifyPlaylist === "string" && obj.spotifyPlaylist
        ? obj.spotifyPlaylist
        : null,
    rotation: isRotation(obj.rotation) ? obj.rotation : DEFAULT_CONFIG.rotation,
    fixedImage:
      obj.fixedImage === null || typeof obj.fixedImage === "string"
        ? ((obj.fixedImage as string | null) ?? DEFAULT_CONFIG.fixedImage)
        : DEFAULT_CONFIG.fixedImage,
    intervalHours: isInterval(obj.intervalHours)
      ? obj.intervalHours
      : DEFAULT_CONFIG.intervalHours,
    minRefreshMinutes: isMinRefresh(obj.minRefreshMinutes)
      ? obj.minRefreshMinutes
      : DEFAULT_CONFIG.minRefreshMinutes,
    pollMinutes: isPollMinutes(obj.pollMinutes)
      ? obj.pollMinutes
      : DEFAULT_CONFIG.pollMinutes,
    renderSaturation: isSaturation(obj.renderSaturation)
      ? obj.renderSaturation
      : DEFAULT_CONFIG.renderSaturation,
    forceRefreshAt:
      typeof obj.forceRefreshAt === "number" && Number.isFinite(obj.forceRefreshAt)
        ? obj.forceRefreshAt
        : DEFAULT_CONFIG.forceRefreshAt,
  };
}

/** Valide la partie de la config que le formulaire de réglages peut écrire. */
export function isValidConfigInput(value: unknown): value is Omit<
  AppConfig,
  "forceRefreshAt"
> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    MODES.includes(obj.mode as DisplayMode) &&
    (obj.spotifyPlaylist === null ||
      typeof obj.spotifyPlaylist === "string") &&
    isRotation(obj.rotation) &&
    (obj.fixedImage === null || typeof obj.fixedImage === "string") &&
    isInterval(obj.intervalHours) &&
    isMinRefresh(obj.minRefreshMinutes) &&
    isPollMinutes(obj.pollMinutes) &&
    isSaturation(obj.renderSaturation)
  );
}

export async function getConfig(): Promise<AppConfig> {
  try {
    const result = await get(CONFIG_PATH, { access: "public" });

    if (!result) {
      return DEFAULT_CONFIG;
    }

    const text = await new Response(result.stream).text();
    const parsed: unknown = JSON.parse(text);
    return mergeConfig(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await put(CONFIG_PATH, JSON.stringify(config), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}
