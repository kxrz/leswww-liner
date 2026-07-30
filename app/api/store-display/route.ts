import { isSafeBase } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { PANELS } from "@/lib/panels";
import { DEFAULT_RENDER, renderForPanel } from "@/lib/render";
import { activePanel, getState } from "@/lib/state";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  // Le nom du fichier vient du navigateur : il construit deux chemins de blob,
  // il ne peut donc pas être repris tel quel.
  const baseName = baseNameWithoutExtension(file.name);

  if (!isSafeBase(baseName)) {
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
  }

  const [state, config] = await Promise.all([getState(), getConfig()]);
  const panel = PANELS[activePanel(state)];

  const cropBlob = await put(`crops/${baseName}.jpg`, file, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/jpeg",
  });

  const pngBuffer = await renderForPanel(
    Buffer.from(await file.arrayBuffer()),
    panel,
    { ...DEFAULT_RENDER, saturation: config.renderSaturation },
  );

  const displayBlob = await put(`display/${baseName}.png`, pngBuffer, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/png",
  });

  return NextResponse.json(
    { cropUrl: cropBlob.url, displayUrl: displayBlob.url, panel: panel.id },
    { status: 200 },
  );
}
