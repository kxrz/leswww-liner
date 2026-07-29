import { listDisplay } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { NextResponse } from "next/server";

function basenameWithoutExt(pathname: string): string {
  const name = pathname.split("/").pop() ?? pathname;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

// mulberry32 seedé par la tranche horaire : le mode aléatoire est stable
// pendant tout l'intervalle configuré, sans état serveur, même si le cron
// du Pi tourne plus souvent.
function seededIndex(seed: number, length: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(r * length);
}

export async function GET(request: Request): Promise<Response> {
  const { blobs } = await listDisplay();

  if (blobs.length === 0) {
    return NextResponse.json(
      { error: "No images available" },
      { status: 404 },
    );
  }

  const config = await getConfig();
  const slot = Math.floor(Date.now() / (config.intervalHours * 3600 * 1000));

  let index = slot % blobs.length;

  if (config.rotation === "random") {
    index = seededIndex(slot, blobs.length);
  } else if (config.rotation === "fixed") {
    index = 0;
    if (config.fixedImage) {
      const target = basenameWithoutExt(config.fixedImage);
      const foundIndex = blobs.findIndex(
        (blob) => basenameWithoutExt(blob.pathname) === target,
      );
      index = foundIndex >= 0 ? foundIndex : 0;
    }
  }

  const selectedBlob = blobs[index];

  // Un re-cadrage écrase le blob display en gardant la même URL : seul
  // uploadedAt trahit le changement de contenu, il entre donc dans l'ETag.
  const etag = `"${selectedBlob.pathname}:${new Date(selectedBlob.uploadedAt).getTime()}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const imageResponse = await fetch(selectedBlob.url);

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
    },
  });
}
