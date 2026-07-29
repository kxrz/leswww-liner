import { createHash } from "node:crypto";
import { listDisplay } from "@/lib/blob";
import { getAlbumRender, nextParisMidnight, parisDayKey } from "@/lib/album";
import type { AppConfig } from "@/lib/config";
import { selectImage } from "@/lib/selection";

export interface CurrentDisplay {
  kind: "gallery" | "album";
  /** Ce qui est affiché, en clair, pour l'interface. */
  label: string;
  url: string;
  revision: string;
  nextChangeAt: number | null;
  /** Renseigné quand le mode est actif mais que rien n'est affichable. */
  problem?: string;
}

/**
 * Ce qui doit être à l'écran maintenant, quel que soit le mode. Les trois
 * routes qui en dépendent (état du Pi, image, statut du site) passent par ici
 * pour ne jamais diverger.
 */
export async function resolveCurrent(
  config: AppConfig,
  now: number = Date.now(),
): Promise<CurrentDisplay | null> {
  if (config.mode === "album") {
    const render = await getAlbumRender();

    if (!render) {
      return {
        kind: "album",
        label: "Album du jour",
        url: "",
        revision: "",
        nextChangeAt: null,
        problem: config.spotifyPlaylist
          ? "L'album du jour n'a pas encore été calculé."
          : "Aucune playlist Spotify configurée.",
      };
    }

    const stale = render.dayKey !== parisDayKey(new Date(now));

    return {
      kind: "album",
      label: `${render.name} — ${render.artist}`,
      url: render.url,
      revision: createHash("sha1")
        .update(`${render.fingerprint}:${config.forceRefreshAt}`)
        .digest("hex")
        .slice(0, 16),
      nextChangeAt: nextParisMidnight(new Date(now)),
      problem: stale
        ? "Le rendu date d'hier, il sera actualisé au prochain passage quotidien."
        : undefined,
    };
  }

  const { blobs } = await listDisplay();
  const selection = selectImage(blobs, config, now);

  if (!selection) {
    return null;
  }

  return {
    kind: "gallery",
    label: selection.base,
    url: selection.url,
    revision: selection.revision,
    nextChangeAt: selection.nextChangeAt,
  };
}
