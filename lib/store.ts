import { get, list, put } from "@vercel/blob";

/** A request from the page. `id` grows with each request; the frame remembers the last one it handled. */
export type Command = { id: number; action: "next" | "refresh" | "show"; guid?: string };

/** What the frame reports after each redraw. */
export type Status = {
  at: string; guid: string; title: string; artist: string; command: number; place?: string; visual?: string;
};

/** A picture made for one track, downloadable from the page. */
export type Visual = { url: string; downloadUrl: string; uploadedAt?: string };

/**
 * Each redraw yields three pictures: what the colour panel shows, the same in black and white for a mono panel,
 * and a 4K wallpaper with the same layout, drawn smooth.
 */
export const KINDS = {
  eink: { suffix: ".png", type: "image/png" },
  bw: { suffix: "-bw.png", type: "image/png" },
  hd: { suffix: "-4k.jpg", type: "image/jpeg" },
} as const;
export type Kind = keyof typeof KINDS;
export type Pictures = Partial<Record<Kind, Visual>>;

const COMMAND = "liner/command.json";
const STATUS = "liner/status.json";
const VISUALS = "liner/pictures/";

async function read<T>(pathname: string): Promise<T | null> {
  try {
    // Straight from origin: a request must reach the frame now, not when the CDN copy expires
    const res = await get(pathname, { access: "public", useCache: false });
    return res?.stream ? ((await new Response(res.stream).json()) as T) : null;
  } catch {
    return null;
  }
}

async function write(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export const readCommand = () => read<Command>(COMMAND);
export const writeCommand = (c: Command) => write(COMMAND, c);
export const readStatus = () => read<Status>(STATUS);
export const writeStatus = (s: Status) => write(STATUS, s);

/** Everything that has hung on the wall, newest first: the public gallery's index. */
export type Hung = { slug: string; guid: string; title: string; artist: string; place?: string; at: string };
const GALLERY = "liner/gallery.json";
export const readGallery = async () => (await read<Hung[]>(GALLERY)) ?? [];

export async function addToGallery(entry: Hung): Promise<void> {
  const gallery = (await readGallery()).filter((h) => h.slug !== entry.slug);
  await write(GALLERY, [entry, ...gallery].slice(0, 500));
}

/** The frame's last sign of life: sent every 15 minutes while it is awake (7:00 to midnight). */
export type Health = { at: string; temp?: number; uptime?: number; version?: string };
const HEALTH = "liner/health.json";
export const readHealth = () => read<Health>(HEALTH);
export const writeHealth = (h: Health) => write(HEALTH, h);

/** Where an artist comes from, once worked out (see lib/map.ts). Keyed by artist and feed hint. */
const ORIGINS = "liner/origins/";
const originPath = (key: string) => `${ORIGINS}${encodeURIComponent(key.toLowerCase()).replace(/%/g, "_")}.json`;

export async function readOrigin(key: string): Promise<string | null> {
  return (await read<{ origin: string }>(originPath(key)))?.origin ?? null;
}

export async function writeOrigin(key: string, origin: string): Promise<void> {
  await write(originPath(key), { origin });
}

/** "https://www.320kbps.club/track/balthazar-linger-on" → "track-balthazar-linger-on". */
export function slug(guid: string): string {
  return new URL(guid).pathname.split("/").filter(Boolean).join("-").replace(/[^a-z0-9-]/gi, "");
}

export async function saveVisual(guid: string, kind: Kind, data: ArrayBuffer): Promise<Visual> {
  const blob = await put(`${VISUALS}${slug(guid)}${KINDS[kind].suffix}`, data, {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: KINDS[kind].type,
    cacheControlMaxAge: 60,
  });
  return { url: blob.url, downloadUrl: blob.downloadUrl };
}

/** Pictures already made, by track slug. */
export async function listVisuals(): Promise<Map<string, Pictures>> {
  const pictures = new Map<string, Pictures>();
  const kinds = (Object.keys(KINDS) as Kind[]).sort((a, b) => KINDS[b].suffix.length - KINDS[a].suffix.length);
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: VISUALS, cursor });
      for (const b of page.blobs) {
        const name = b.pathname.slice(VISUALS.length);
        const kind = kinds.find((k) => name.endsWith(KINDS[k].suffix));
        if (!kind) continue;
        const key = name.slice(0, -KINDS[kind].suffix.length);
        pictures.set(key, {
          ...pictures.get(key),
          [kind]: { url: b.url, downloadUrl: b.downloadUrl, uploadedAt: new Date(b.uploadedAt).toISOString() },
        });
      }
      cursor = page.cursor;
    } while (cursor);
  } catch {
    // no Blob store when running locally: the page renders without pictures
  }
  return pictures;
}
