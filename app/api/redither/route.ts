import { listCrops } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { PANELS } from "@/lib/panels";
import { DEFAULT_RENDER, renderForPanel } from "@/lib/render";
import { basenameWithoutExt } from "@/lib/selection";
import { activePanel, getState, saveState } from "@/lib/state";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Recalcule les PNG de display/ pour la dalle actuellement détectée, une
 * image par appel : re-dithérer toute une galerie dépasserait les 10 s de
 * timeout d'une fonction Vercel. Le client boucle puis finalise.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { base?: unknown; finalize?: unknown };

  try {
    body = (await request.json()) as { base?: unknown; finalize?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const [state, config] = await Promise.all([getState(), getConfig()]);
  const panelId = activePanel(state);

  if (body.finalize === true) {
    await saveState({
      ...state,
      renderedPanel: panelId,
      renderedSaturation: config.renderSaturation,
    });
    return NextResponse.json({ ok: true, renderedPanel: panelId });
  }

  if (typeof body.base !== "string" || body.base.length === 0) {
    return NextResponse.json({ error: "Base manquante" }, { status: 400 });
  }

  const { blobs } = await listCrops();
  const crop = blobs.find((b) => basenameWithoutExt(b.pathname) === body.base);

  if (!crop) {
    return NextResponse.json({ error: "Cadrage introuvable" }, { status: 404 });
  }

  const source = await fetch(crop.url);

  if (!source.ok) {
    return NextResponse.json({ error: "Cadrage illisible" }, { status: 502 });
  }

  const pngBuffer = await renderForPanel(
    Buffer.from(await source.arrayBuffer()),
    PANELS[panelId],
    { ...DEFAULT_RENDER, saturation: config.renderSaturation },
  );

  await put(`display/${body.base}.png`, pngBuffer, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/png",
  });

  return NextResponse.json({ ok: true, base: body.base, panel: panelId });
}
