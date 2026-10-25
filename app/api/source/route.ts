import { isLoggedIn } from "@/lib/auth";
import { getItems } from "@/lib/feed";
import { readGallery } from "@/lib/store";

export const dynamic = "force-dynamic";

/** A feed seen before following it: how many tracks, the newest three, and how many have hung on the wall already. */
export async function GET(request: Request) {
  if (!(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url.startsWith("https://")) return new Response("Bad request", { status: 400 });
  const [items, gallery] = await Promise.all([getItems(url), readGallery()]);
  const hung = new Set(gallery.map((h) => h.guid));
  return Response.json({
    count: items.length,
    hung: items.filter((i) => hung.has(i.guid)).length,
    newest: items.slice(0, 3).map(({ title, artist, cover }) => ({ title, artist, cover })),
  });
}
