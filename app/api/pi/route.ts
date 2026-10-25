import { isDevice } from "@/lib/auth";
import { SITE_FEED } from "@/lib/sources";
import { addToGallery, readCommand, readSettings, readStatus, slug, writeStatus, type Status } from "@/lib/store";

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
  const s = (await request.json().catch(() => ({}))) as Partial<Status>;
  if (typeof s.guid !== "string" || !s.guid.startsWith("https://") || typeof s.title !== "string") {
    return new Response("Bad request", { status: 400 });
  }
  const at = new Date().toISOString();
  const cap = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
  const command = Number(s.command ?? 0);
  const place = cap(s.place);
  const refused = cap(s.refused);
  if (refused) {
    // Nothing new on the wall: keep what is there, just say the request was handled and why it was not hung
    const current = await readStatus();
    await writeStatus({
      ...(current ?? { at, guid: s.guid, title: s.title.slice(0, 200), artist: cap(s.artist) ?? "", place }),
      command,
      refused,
      reason: cap(s.reason),
    });
    return new Response(null, { status: 204 });
  }
  await addToGallery({ slug: slug(s.guid), guid: s.guid, title: s.title.slice(0, 200), artist: cap(s.artist) ?? "", place, at });
  await writeStatus({
    at,
    guid: s.guid,
    title: s.title.slice(0, 200),
    artist: cap(s.artist) ?? "",
    command,
    place,
    visual: typeof s.visual === "string" ? s.visual : undefined,
  });
  return new Response(null, { status: 204 });
}
