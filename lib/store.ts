import { get, put } from "@vercel/blob";

/** Ce que la page demande au cadre. `id` croît à chaque demande : le Pi retient le dernier traité. */
export type Command = { id: number; action: "next" | "refresh" | "show"; guid?: string };

/** Ce que le Pi rapporte après chaque affichage. */
export type Status = { at: string; guid: string; title: string; artist: string; command: number };

const COMMAND = "cadre/command.json";
const STATUS = "cadre/status.json";

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
