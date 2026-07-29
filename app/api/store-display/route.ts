import { ditherToACeP } from "@/lib/dither";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import sharp from "sharp";

function baseNameWithoutExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const cropBlob = await put(`crops/${file.name}`, file, {
    access: "public",
    allowOverwrite: true,
  });

  const imageBuffer = Buffer.from(await file.arrayBuffer());

  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize({ width: 800, height: 480, fit: "cover" })
    // Boost léger seulement : la compensation de la fadeur du panneau se fait
    // désormais via la palette mesurée dans lib/dither.ts.
    .modulate({ brightness: 1.1, saturation: 1.3 })
    .blur(0.4)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pngBuffer = await ditherToACeP(data, info.width, info.height);

  const baseName = baseNameWithoutExtension(file.name);
  const displayBlob = await put(`display/${baseName}.png`, pngBuffer, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/png",
  });

  return NextResponse.json(
    { cropUrl: cropBlob.url, displayUrl: displayBlob.url },
    { status: 200 },
  );
}
