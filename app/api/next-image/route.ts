import { listDisplay } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { selectImage } from "@/lib/selection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const [{ blobs }, config] = await Promise.all([listDisplay(), getConfig()]);

  const selection = selectImage(blobs, config, Date.now());

  if (!selection) {
    return NextResponse.json({ error: "No images available" }, { status: 404 });
  }

  const etag = `"${selection.revision}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const imageResponse = await fetch(selection.url);

  if (!imageResponse.ok) {
    return NextResponse.json(
      { error: "Failed to fetch source image" },
      { status: 502 },
    );
  }

  const pngBuffer = Buffer.from(await imageResponse.arrayBuffer());

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      ETag: etag,
      "X-Tekpi-Revision": selection.revision,
    },
  });
}
