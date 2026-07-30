import { appendJournal, sanitizeEntry, type JournalEntry } from "@/lib/journal";
import { panelFromDriverName } from "@/lib/panels";
import { getState, saveState } from "@/lib/state";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HeartbeatBody {
  driver?: unknown;
  revision?: unknown;
  refreshed?: unknown;
  error?: unknown;
  events?: unknown;
}

// Un cycle du Pi produit une poignée d'événements ; au-delà c'est une boucle.
const MAX_EVENTS_PER_CALL = 20;

/**
 * Le Pi se signale : après chaque rafraîchissement, en cas d'erreur, et
 * périodiquement. Volontairement pas à chaque sondage, pour ne pas écrire
 * dans le Blob à chaque minute.
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

  const events: JournalEntry[] = Array.isArray(body.events)
    ? body.events
        .slice(0, MAX_EVENTS_PER_CALL)
        .map((e) => sanitizeEntry({ ...(e as object), source: "pi" }))
        .filter((e): e is JournalEntry => e !== null)
    : [];

  await Promise.all([
    saveState({
      ...previous,
      lastSeenAt: now,
      firstSeenAt: previous.firstSeenAt ?? now,
      driver: driver ?? previous.driver,
      panel: detected ?? previous.panel,
      displayedRevision: revision,
      lastRefreshAt: refreshed ? now : previous.lastRefreshAt,
      refreshCount: previous.refreshCount + (refreshed ? 1 : 0),
      lastError:
        typeof body.error === "string" && body.error ? body.error : null,
    }),
    appendJournal(events),
  ]);

  return NextResponse.json({ ok: true });
}
