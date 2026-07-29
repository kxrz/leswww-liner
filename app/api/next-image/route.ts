import { getConfig } from "@/lib/config";
import { resolveCurrent } from "@/lib/current";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const config = await getConfig();
  const current = await resolveCurrent(config);

  if (!current || !current.url) {
    return NextResponse.json(
      { error: current?.problem ?? "No images available" },
      { status: 404 },
    );
  }

  const etag = `"${current.revision}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const imageResponse = await fetch(current.url, { cache: "no-store" });

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
      "X-Tekpi-Revision": current.revision,
    },
  });
}
