import { get, list, put } from "@vercel/blob";

/** Ce que la page demande au cadre. `id` croît à chaque demande : le Pi retient le dernier traité. */
export type Command = { id: number; action: "next" | "refresh" | "show"; guid?: string };

/** Ce que le Pi rapporte après chaque affichage. */
export type Status = {
  at: string; guid: string; title: string; artist: string; command: number; place?: string; visual?: string;
};

/** Un visuel tel qu'affiché, téléchargeable depuis la page. */
export type Visual = { url: string; downloadUrl: string };

const COMMAND = "cadre/command.json";
const STATUS = "cadre/status.json";
const VISUALS = "visuels/";

async function read<T>(pathname: string): Promise<T | null> {
  try {
    const res = await get(pathname, { access: "public" });
    return res ? ((await new Response(res.stream).json()) as T) : null;
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
    cacheControlMaxAge: 60, // minimum autorisé : une demande peut mettre jusqu'à une minute à être vue
  });
}

export const readCommand = () => read<Command>(COMMAND);
export const writeCommand = (c: Command) => write(COMMAND, c);
export const readStatus = () => read<Status>(STATUS);
export const writeStatus = (s: Status) => write(STATUS, s);

/** « https://www.320kbps.club/track/balthazar-linger-on » → « track-balthazar-linger-on ». */
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

/** Les visuels déjà affichés, par slug. */
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
    // pas de store configuré en local : la page s'affiche sans visuels
  }
  return visuals;
}
