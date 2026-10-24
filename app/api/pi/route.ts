import { isDevice } from "@/lib/auth";
import { SITE_FEED } from "@/lib/sources";
import { addToGallery, readCommand, readSettings, slug, writeStatus, type Status } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The frame asks whether there is anything to do, and which feed to follow. */
export async function GET(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const [command, settings] = await Promise.all([readCommand(), readSettings()]);
  return Response.json({ id: 0, action: "none", ...command, feed: settings?.feed ?? SITE_FEED.url });
}

/** The frame reports what it just drew. */
export async function POST(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const s = (await request.json()) as Partial<Status>;
  if (typeof s.guid !== "string" || typeof s.title !== "string") {
    return new Response("Bad request", { status: 400 });
  }
  const at = new Date().toISOString();
  const place = typeof s.place === "string" ? s.place : undefined;
  const refused = typeof s.refused === "string" ? s.refused : undefined;
  if (!refused) {
    await addToGallery({ slug: slug(s.guid), guid: s.guid, title: s.title, artist: String(s.artist ?? ""), place, at });
  }
  await writeStatus({
    at,
    guid: s.guid,
    title: s.title,
    artist: String(s.artist ?? ""),
    command: Number(s.command ?? 0),
    place,
    visual: typeof s.visual === "string" ? s.visual : undefined,
    refused,
  });
  return new Response(null, { status: 204 });
}
