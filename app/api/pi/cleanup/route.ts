import { del, list } from "@vercel/blob";
import { isDevice } from "@/lib/auth";

/** One-off: remove what earlier versions left in Blob (cadre/, visuels/). Deleted once used. */
export async function POST(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const removed: string[] = [];
  for (const prefix of ["cadre/", "visuels/", "config/", "state/", "originals/", "crops/", "display/", "album/", "journal/"]) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      removed.push(...page.blobs.map((b) => b.pathname));
      cursor = page.cursor;
    } while (cursor);
  }
  return Response.json({ removed });
}
