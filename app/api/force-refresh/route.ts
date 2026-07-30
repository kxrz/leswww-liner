import { getConfig, saveConfig } from "@/lib/config";
import { logServer } from "@/lib/journal";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * « Afficher maintenant » : bouscule forceRefreshAt, ce qui change la révision
 * calculée par selectImage() et fait donc rafraîchir le Pi à son prochain
 * sondage, en passant outre le délai de garde.
 */
export async function POST(): Promise<NextResponse> {
  const config = await getConfig();
  await saveConfig({ ...config, forceRefreshAt: Date.now() });
  await logServer("info", "Affichage forcé depuis le site.");

  return NextResponse.json({ ok: true });
}
