const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

export interface PlaylistAlbum {
  id: string;
  name: string;
  artist: string;
  releaseDate: string;
  coverUrl: string | null;
  url: string;
}

export class SpotifyError extends Error {}

/**
 * Accepte une URL de partage, un URI `spotify:playlist:…` ou un identifiant nu.
 *
 * Attention : depuis novembre 2024, les playlists éditoriales et algorithmiques
 * de Spotify ne sont plus lisibles par les applications créées après cette
 * date. Seules les playlists publiques créées par un utilisateur fonctionnent.
 */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const patterns = [
    /playlist[/:]([a-zA-Z0-9]{22})/,
    /^([a-zA-Z0-9]{22})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export async function getAccessToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!id || !secret) {
    throw new SpotifyError(
      "SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET manquants",
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new SpotifyError(
      `authentification refusée (${response.status}), vérifier les identifiants`,
    );
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new SpotifyError("réponse d'authentification inattendue");
  }

  return data.access_token;
}

interface RawAlbum {
  id?: string;
  name?: string;
  artists?: { name?: string }[];
  release_date?: string;
  images?: { url?: string; width?: number }[];
  external_urls?: { spotify?: string };
}

function normalize(album: RawAlbum): PlaylistAlbum | null {
  if (!album.id || !album.name) {
    return null;
  }

  // La première image est la plus grande ; on garde la plus proche de 640 px
  // pour ne pas télécharger 2000 px inutiles avant de réduire à 340.
  const images = (album.images ?? []).filter((i) => typeof i.url === "string");
  const cover =
    images.find((i) => (i.width ?? 0) >= 600 && (i.width ?? 0) <= 800) ??
    images[0];

  return {
    id: album.id,
    name: album.name,
    artist: album.artists?.[0]?.name ?? "Artiste inconnu",
    releaseDate: album.release_date ?? "",
    coverUrl: cover?.url ?? null,
    url: album.external_urls?.spotify ?? `https://open.spotify.com/album/${album.id}`,
  };
}

const FIELDS =
  "items(track(album(id,name,artists(name),release_date,images,external_urls))),next";

/**
 * Parcourt une playlist publique et en extrait les albums distincts.
 *
 * L'endpoint `/tracks` a été remplacé par `/items` le 11 février 2026 ; on
 * tente le nouveau puis on retombe sur l'ancien, le temps que la bascule soit
 * partout effective.
 */
export async function fetchPlaylistAlbums(
  playlistId: string,
  token: string,
): Promise<PlaylistAlbum[]> {
  const albums = new Map<string, PlaylistAlbum>();
  let endpoint: "items" | "tracks" = "items";
  let url = `${API}/playlists/${playlistId}/${endpoint}?limit=100&fields=${encodeURIComponent(FIELDS)}`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.status === 404 && endpoint === "items") {
      endpoint = "tracks";
      url = `${API}/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(FIELDS)}`;
      continue;
    }

    if (response.status === 404) {
      throw new SpotifyError(
        "playlist introuvable : elle doit être publique, et les playlists éditoriales de Spotify ne sont plus accessibles",
      );
    }

    if (!response.ok) {
      throw new SpotifyError(`lecture de la playlist refusée (${response.status})`);
    }

    const page = (await response.json()) as {
      items?: { track?: { album?: RawAlbum } | null }[];
      next?: string | null;
    };

    for (const item of page.items ?? []) {
      const album = item.track?.album;
      if (!album) {
        continue;
      }
      const normalized = normalize(album);
      if (normalized && !albums.has(normalized.id)) {
        albums.set(normalized.id, normalized);
      }
    }

    url = page.next ?? "";
  }

  if (albums.size === 0) {
    throw new SpotifyError("aucun album trouvé dans cette playlist");
  }

  return [...albums.values()];
}

/** Pistes d'un album, dans l'ordre du disque. */
export async function fetchAlbumTracks(
  albumId: string,
  token: string,
  limit = 6,
): Promise<string[]> {
  const response = await fetch(
    `${API}/albums/${albumId}/tracks?limit=${Math.min(50, limit * 2)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { items?: { name?: string }[] };

  return (data.items ?? [])
    .map((track) => track.name)
    .filter((name): name is string => typeof name === "string")
    .slice(0, limit);
}
