import { createHash } from "node:crypto";
import type { AppConfig } from "@/lib/config";

export interface DisplayBlob {
  pathname: string;
  url: string;
  uploadedAt: Date | string;
}

export interface Selection {
  base: string;
  pathname: string;
  url: string;
  /**
   * Change dès que l'image à afficher change, y compris quand un re-cadrage
   * écrase le blob à URL identique (seul uploadedAt bouge) ou quand un
   * « Afficher maintenant » est déclenché depuis le site.
   */
  revision: string;
  /** Instant du prochain changement automatique, null en mode image fixe. */
  nextChangeAt: number | null;
}

export function basenameWithoutExt(pathname: string): string {
  const name = pathname.split("/").pop() ?? pathname;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

// mulberry32 seedé par la tranche horaire : le mode aléatoire est stable
// pendant tout l'intervalle configuré, sans état serveur, même si le Pi
// interroge toutes les minutes.
function seededIndex(seed: number, length: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(r * length);
}

export function selectImage(
  blobs: readonly DisplayBlob[],
  config: AppConfig,
  now: number,
): Selection | null {
  if (blobs.length === 0) {
    return null;
  }

  const sorted = [...blobs].sort((a, b) => a.pathname.localeCompare(b.pathname));
  const intervalMs = config.intervalHours * 3600 * 1000;
  const slot = Math.floor(now / intervalMs);

  let index = slot % sorted.length;
  let nextChangeAt: number | null = (slot + 1) * intervalMs;

  if (config.rotation === "random") {
    index = seededIndex(slot, sorted.length);
  } else if (config.rotation === "fixed") {
    index = 0;
    nextChangeAt = null;

    if (config.fixedImage) {
      const target = basenameWithoutExt(config.fixedImage);
      const found = sorted.findIndex(
        (blob) => basenameWithoutExt(blob.pathname) === target,
      );
      index = found >= 0 ? found : 0;
    }
  }

  const blob = sorted[index];
  const uploadedAt = new Date(blob.uploadedAt).getTime();
  const revision = createHash("sha1")
    .update(`${blob.pathname}:${uploadedAt}:${config.forceRefreshAt}`)
    .digest("hex")
    .slice(0, 16);

  return {
    base: basenameWithoutExt(blob.pathname),
    pathname: blob.pathname,
    url: blob.url,
    revision,
    nextChangeAt,
  };
}
