import { get, put } from "@vercel/blob";
import {
  fetchAlbumTracks,
  fetchPlaylistAlbums,
  getAccessToken,
  type PlaylistAlbum,
} from "@/lib/spotify";

export interface AlbumOfTheDay extends PlaylistAlbum {
  tracks: string[];
  /** Jour de référence, au format AAAA-MM-JJ en heure de Paris. */
  dayKey: string;
}

interface PlaylistCache {
  playlistId: string;
  fetchedAt: number;
  albums: PlaylistAlbum[];
}

const CACHE_PATH = "state/playlist-cache.json";

async function readCache(): Promise<PlaylistCache | null> {
  try {
    const result = await get(CACHE_PATH, { access: "public" });

    if (!result) {
      return null;
    }

    const parsed: unknown = JSON.parse(
      await new Response(result.stream).text(),
    );

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const cache = parsed as PlaylistCache;

    return Array.isArray(cache.albums) && cache.albums.length > 0
      ? cache
      : null;
  } catch {
    return null;
  }
}

async function writeCache(cache: PlaylistCache): Promise<void> {
  await put(CACHE_PATH, JSON.stringify(cache), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Jour courant à Paris : l'album change à minuit local, pas à minuit UTC. */
export function parisDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayIndex(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Permutation du catalogue propre à un cycle, sans correction de jonction. */
function basePermutation(
  sorted: readonly PlaylistAlbum[],
  cycle: number,
): PlaylistAlbum[] {
  const arr = [...sorted];
  const random = mulberry32(cycle + 1);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Sélectionne l'album du jour sans stocker d'historique.
 *
 * Le catalogue est mélangé avec une graine dérivée du numéro de cycle, et on
 * prend la n-ième position du cycle : chaque album passe donc exactement une
 * fois par cycle, et deux exécutions le même jour donnent le même album,
 * contrairement à un simple tirage aléatoire.
 *
 * À la jonction de deux cycles, le premier album du nouveau pourrait répéter
 * le dernier de l'ancien. Dans ce cas on échange les deux premières positions
 * plutôt que de faire tourner la liste : l'échange laisse la dernière position
 * intacte, donc la correction ne se propage pas au cycle suivant.
 */
export function pickForDay(
  albums: readonly PlaylistAlbum[],
  dayKey: string,
): PlaylistAlbum {
  const sorted = [...albums].sort((a, b) => a.id.localeCompare(b.id));
  const n = sorted.length;
  const index = dayIndex(dayKey);

  if (n === 1) {
    return sorted[0];
  }

  // Avec deux albums, l'alternance stricte est la seule séquence sans
  // répétition ; l'échange ci-dessous ne tiendrait pas.
  if (n === 2) {
    return sorted[((index % 2) + 2) % 2];
  }

  const cycle = Math.floor(index / n);
  const position = ((index % n) + n) % n;
  const current = basePermutation(sorted, cycle);

  if (current[0].id === basePermutation(sorted, cycle - 1)[n - 1].id) {
    [current[0], current[1]] = [current[1], current[0]];
  }

  return current[position];
}

/**
 * Rafraîchit le catalogue depuis Spotify. En cas d'échec, le cache existant
 * est conservé : une panne d'API ne doit pas vider l'écran.
 */
export async function refreshPlaylistCache(
  playlistId: string,
): Promise<{ albums: PlaylistAlbum[]; fromCache: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const albums = await fetchPlaylistAlbums(playlistId, token);
    await writeCache({ playlistId, fetchedAt: Date.now(), albums });
    return { albums, fromCache: false };
  } catch (error) {
    const cached = await readCache();
    const message = error instanceof Error ? error.message : String(error);

    if (cached && cached.playlistId === playlistId) {
      return { albums: cached.albums, fromCache: true, error: message };
    }

    throw error;
  }
}

/** Catalogue en cache, sans appel réseau. */
export async function cachedAlbums(
  playlistId: string,
): Promise<PlaylistAlbum[] | null> {
  const cached = await readCache();
  return cached && cached.playlistId === playlistId ? cached.albums : null;
}

export async function albumOfTheDay(
  playlistId: string,
  options: { refresh?: boolean; now?: Date } = {},
): Promise<{ album: AlbumOfTheDay; fromCache: boolean; warning?: string }> {
  const dayKey = parisDayKey(options.now);

  let albums: PlaylistAlbum[] | null = options.refresh
    ? null
    : await cachedAlbums(playlistId);
  let fromCache = albums !== null;
  let warning: string | undefined;

  if (!albums) {
    const refreshed = await refreshPlaylistCache(playlistId);
    albums = refreshed.albums;
    fromCache = refreshed.fromCache;
    warning = refreshed.error;
  }

  const picked = pickForDay(albums, dayKey);

  // Les pistes ne sont pas mises en cache : un seul appel par jour, et une
  // liste vide reste un rendu acceptable.
  let tracks: string[] = [];
  try {
    tracks = await fetchAlbumTracks(picked.id, await getAccessToken());
  } catch {
    tracks = [];
  }

  return { album: { ...picked, tracks, dayKey }, fromCache, warning };
}

/** Ce qui est actuellement rendu dans `album/today.png`. */
export interface AlbumRender {
  albumId: string;
  name: string;
  artist: string;
  dayKey: string;
  renderedAt: number;
  url: string;
  /** Empreinte du contenu, pour la révision servie au Pi. */
  fingerprint: string;
  warning: string | null;
}

const RENDER_PATH = "state/album.json";

export async function getAlbumRender(): Promise<AlbumRender | null> {
  try {
    const result = await get(RENDER_PATH, { access: "public" });

    if (!result) {
      return null;
    }

    const parsed: unknown = JSON.parse(
      await new Response(result.stream).text(),
    );

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const render = parsed as AlbumRender;
    return typeof render.fingerprint === "string" ? render : null;
  } catch {
    return null;
  }
}

export async function saveAlbumRender(render: AlbumRender): Promise<void> {
  await put(RENDER_PATH, JSON.stringify(render), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Prochain minuit à Paris : l'instant où l'album du jour bascule. */
export function nextParisMidnight(now: Date = new Date()): number {
  const today = parisDayKey(now);

  for (let hours = 1; hours <= 36; hours++) {
    const candidate = new Date(now.getTime() + hours * 3600 * 1000);
    if (parisDayKey(candidate) !== today) {
      // On tient l'heure qui contient la bascule, on redescend au quart d'heure.
      for (let minutes = 0; minutes <= 60; minutes += 15) {
        const finer = new Date(
          now.getTime() + (hours - 1) * 3600 * 1000 + minutes * 60 * 1000,
        );
        if (parisDayKey(finer) !== today) {
          return finer.getTime();
        }
      }
      return candidate.getTime();
    }
  }

  return now.getTime() + 24 * 3600 * 1000;
}
