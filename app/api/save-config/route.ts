import { getConfig, isValidConfigInput, saveConfig } from "@/lib/config";
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

  // forceRefreshAt n'est jamais fourni par le formulaire : il appartient au
  // bouton « Afficher maintenant » et ne doit pas être remis à zéro ici.
  const current = await getConfig();
  await saveConfig({ ...body, forceRefreshAt: current.forceRefreshAt });

  return NextResponse.json({ ok: true }, { status: 200 });
}
