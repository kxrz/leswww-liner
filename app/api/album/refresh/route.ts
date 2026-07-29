import { albumOfTheDay, saveAlbumRender } from "@/lib/album";
import { composeAlbum } from "@/lib/compose";
import { getConfig } from "@/lib/config";
import { PANELS } from "@/lib/panels";
import { DEFAULT_RENDER } from "@/lib/render";
import { parsePlaylistId } from "@/lib/spotify";
import { activePanel, getState } from "@/lib/state";
import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Calcule et publie l'album du jour.
 *
 * Appelée par le cron quotidien de Vercel (une exécution par jour sur le plan
 * hobby, ce qui correspond exactement au besoin) et par le bouton du site.
 * Vercel signe ses appels de cron avec CRON_SECRET ; en son absence la route
 * reste ouverte, comme le reste de l'application.
 */
async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [config, state] = await Promise.all([getConfig(), getState()]);
  const playlistId = config.spotifyPlaylist
    ? parsePlaylistId(config.spotifyPlaylist)
    : null;

  if (!playlistId) {
    return NextResponse.json(
      { error: "Aucune playlist Spotify valide configurée" },
      { status: 400 },
    );
  }

  const panel = PANELS[activePanel(state)];

  try {
    // Le cron rafraîchit le catalogue ; le bouton du site se contente du cache
    // pour rester rapide, sauf si le cache est vide.
    const isCron = request.headers.get("user-agent")?.includes("vercel-cron");
    const { album, fromCache, warning } = await albumOfTheDay(playlistId, {
      refresh: Boolean(isCron),
    });

    const png = await composeAlbum(album, panel, {
      ...DEFAULT_RENDER,
      saturation: config.renderSaturation,
    });

    const blob = await put("album/today.png", png, {
      access: "public",
      allowOverwrite: true,
      contentType: "image/png",
    });

    const fingerprint = createHash("sha1")
      .update(
        `${album.id}:${album.dayKey}:${panel.id}:${config.renderSaturation}:${album.tracks.join("|")}`,
      )
      .digest("hex")
      .slice(0, 16);

    await saveAlbumRender({
      albumId: album.id,
      name: album.name,
      artist: album.artist,
      dayKey: album.dayKey,
      renderedAt: Date.now(),
      url: blob.url,
      fingerprint,
      warning: warning ?? null,
    });

    return NextResponse.json({
      ok: true,
      album: { id: album.id, name: album.name, artist: album.artist },
      dayKey: album.dayKey,
      fromCache,
      warning: warning ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec du rendu" },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
