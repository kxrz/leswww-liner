import { isDevice } from "@/lib/auth";
import { addToGallery, removeFromGallery, slug } from "@/lib/store";

/** The frame adds a track it has drawn without hanging it (liner.py --seed), so the gallery is not empty. */
export async function POST(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const s = (await request.json().catch(() => ({}))) as { guid?: unknown; title?: unknown; artist?: unknown; place?: unknown };
  if (typeof s.guid !== "string" || !s.guid.startsWith("https://") || typeof s.title !== "string") {
    return new Response("Bad request", { status: 400 });
  }
  const cap = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
  await addToGallery({
    slug: slug(s.guid), guid: s.guid, title: s.title.slice(0, 200), artist: cap(s.artist) ?? "",
    place: cap(s.place), at: new Date().toISOString(),
  });
  return new Response(null, { status: 204 });
}

/** Moderation: take a track out of the gallery and delete its pictures. DELETE /api/pi/gallery?guid=… */
export async function DELETE(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const guid = new URL(request.url).searchParams.get("guid");
  if (!guid?.startsWith("https://")) return new Response("Bad request", { status: 400 });
  await removeFromGallery(guid);
  return new Response(null, { status: 204 });
}
