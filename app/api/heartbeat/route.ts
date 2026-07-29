import { panelFromDriverName } from "@/lib/panels";
import { getState, saveState } from "@/lib/state";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HeartbeatBody {
  driver?: unknown;
  revision?: unknown;
  refreshed?: unknown;
  error?: unknown;
}

/**
 * Le Pi se signale : après chaque rafraîchissement, en cas d'erreur, et
 * périodiquement. Volontairement pas à chaque sondage, pour ne pas écrire
 * dans le Blob toutes les minutes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HeartbeatBody;

  try {
    body = (await request.json()) as HeartbeatBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const previous = await getState();
  const now = Date.now();

  const driver = typeof body.driver === "string" ? body.driver : null;
  const detected = driver ? panelFromDriverName(driver) : null;
  const refreshed = body.refreshed === true;
  const revision =
    typeof body.revision === "string" && body.revision.length > 0
      ? body.revision
      : previous.displayedRevision;

  await saveState({
    ...previous,
    lastSeenAt: now,
    driver: driver ?? previous.driver,
    panel: detected ?? previous.panel,
    displayedRevision: revision,
    lastRefreshAt: refreshed ? now : previous.lastRefreshAt,
    lastError: typeof body.error === "string" && body.error ? body.error : null,
  });

  return NextResponse.json({ ok: true });
}
