import { isDevice } from "@/lib/auth";
import { readCommand, writeStatus, type Status } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The frame asks whether there is anything to do. */
export async function GET(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json((await readCommand()) ?? { id: 0, action: "none" });
}

/** The frame reports what it just drew. */
export async function POST(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const s = (await request.json()) as Partial<Status>;
  if (typeof s.guid !== "string" || typeof s.title !== "string") {
    return new Response("Bad request", { status: 400 });
  }
  await writeStatus({
    at: new Date().toISOString(),
    guid: s.guid,
    title: s.title,
    artist: String(s.artist ?? ""),
    command: Number(s.command ?? 0),
    place: typeof s.place === "string" ? s.place : undefined,
    visual: typeof s.visual === "string" ? s.visual : undefined,
  });
  return new Response(null, { status: 204 });
}
