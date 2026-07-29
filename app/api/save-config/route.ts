import { getConfig, isValidConfigInput, saveConfig } from "@/lib/config";
import { parsePlaylistId } from "@/lib/spotify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json();

  if (!isValidConfigInput(body)) {
    return NextResponse.json(
      { error: "Configuration invalide" },
      { status: 400 },
    );
  }

  // Valider l'identifiant tout de suite : sinon l'utilisateur enregistre,
  // repart satisfait, et ne découvre l'erreur qu'au prochain calcul d'album.
  if (body.mode === "album") {
    if (!body.spotifyPlaylist) {
      return NextResponse.json(
        { error: "Renseigner une playlist Spotify pour ce mode." },
        { status: 400 },
      );
    }
    if (!parsePlaylistId(body.spotifyPlaylist)) {
      return NextResponse.json(
        {
          error:
            "Lien de playlist non reconnu. Coller l'URL de partage Spotify, ou l'identifiant de 22 caractères.",
        },
        { status: 400 },
      );
    }
  }

  // forceRefreshAt n'est jamais fourni par le formulaire : il appartient au
  // bouton « Afficher maintenant » et ne doit pas être remis à zéro ici.
  const current = await getConfig();
  await saveConfig({ ...body, forceRefreshAt: current.forceRefreshAt });

  return NextResponse.json({ ok: true }, { status: 200 });
}
