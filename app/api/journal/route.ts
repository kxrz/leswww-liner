import { getJournal } from "@/lib/journal";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint distinct de `/api/status` : le journal est plus volumineux et n'a
 * pas besoin d'être rapatrié à chaque sondage de l'onglet Écran.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ entries: await getJournal() });
}
