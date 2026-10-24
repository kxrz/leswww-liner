import { get, list, put } from "@vercel/blob";

/** A request from the page. `id` grows with each request; the frame remembers the last one it handled. */
export type Command = { id: number; action: "next" | "refresh" | "show"; guid?: string };

/** What the frame reports after each redraw. */
export type Status = {
  at: string; guid: string; title: string; artist: string; command: number; place?: string; visual?: string;
};

/** A picture as drawn on the frame, downloadable from the page. */
export type Visual = { url: string; downloadUrl: string };

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

/** "https://www.320kbps.club/track/balthazar-linger-on" → "track-balthazar-linger-on". */
export function slug(guid: string): string {
  return new URL(guid).pathname.split("/").filter(Boolean).join("-").replace(/[^a-z0-9-]/gi, "");
}

export async function saveVisual(guid: string, png: ArrayBuffer): Promise<Visual> {
  const blob = await put(`${VISUALS}${slug(guid)}.png`, png, {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "image/png",
    cacheControlMaxAge: 60,
  });
  return { url: blob.url, downloadUrl: blob.downloadUrl };
}

/** Pictures already drawn, by slug. */
export async function listVisuals(): Promise<Map<string, Visual>> {
  const visuals = new Map<string, Visual>();
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: VISUALS, cursor });
      for (const b of page.blobs) {
        visuals.set(b.pathname.slice(VISUALS.length, -4), { url: b.url, downloadUrl: b.downloadUrl });
      }
      cursor = page.cursor;
    } while (cursor);
  } catch {
    // no Blob store when running locally: the page renders without pictures
  }
  return visuals;
}
