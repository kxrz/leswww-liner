import { listDisplay } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { activePanel, getState } from "@/lib/state";
import { selectImage } from "@/lib/selection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint interrogé par le Pi à chaque minute. Toute la décision est prise
 * ici : le Pi n'a rien à calculer, il obéit à `refresh`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const piRevision = url.searchParams.get("revision");

  const [{ blobs }, config, state] = await Promise.all([
    listDisplay(),
    getConfig(),
    getState(),
  ]);

  const now = Date.now();
  const selection = selectImage(blobs, config, now);

  if (!selection) {
    return NextResponse.json({
      refresh: false,
      revision: null,
      reason: "no-images",
      pollSeconds: 300,
    });
  }

  const changed = piRevision !== selection.revision;
  // Un « Afficher maintenant » postérieur au dernier rafraîchissement passe
  // outre le délai de garde ; sinon on protège la dalle.
  const forced =
    config.forceRefreshAt > 0 &&
    config.forceRefreshAt > (state.lastRefreshAt ?? 0);
  const minRefreshMs = config.minRefreshMinutes * 60 * 1000;
  const sinceLast = now - (state.lastRefreshAt ?? 0);
  const throttled = !forced && minRefreshMs > 0 && sinceLast < minRefreshMs;

  const refresh = changed && !throttled;

  return NextResponse.json({
    refresh,
    revision: selection.revision,
    reason: !changed
      ? "up-to-date"
      : throttled
        ? "throttled"
        : forced
          ? "forced"
          : "changed",
    retryAfterSeconds: throttled
      ? Math.max(1, Math.ceil((minRefreshMs - sinceLast) / 1000))
      : 0,
    expectedPanel: activePanel(state),
    pollSeconds: 60,
  });
}
