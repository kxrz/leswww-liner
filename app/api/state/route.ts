import { getConfig } from "@/lib/config";
import { resolveCurrent } from "@/lib/current";
import { getState } from "@/lib/state";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint interrogé par le Pi à chaque minute. Toute la décision est prise
 * ici : le Pi n'a rien à calculer, il obéit à `refresh`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const piRevision = url.searchParams.get("revision");

  const [config, state] = await Promise.all([getConfig(), getState()]);

  const now = Date.now();
  const selection = await resolveCurrent(config, now);

  if (!selection || !selection.url) {
    return NextResponse.json({
      refresh: false,
      revision: null,
      reason: selection?.problem ? "not-ready" : "no-images",
      detail: selection?.problem ?? null,
      pollSeconds: config.pollMinutes * 60,
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
    // Délai avant le prochain sondage. Le cron du Pi tourne à la minute mais
    // le script s'arrête aussitôt si ce délai n'est pas écoulé : la cadence se
    // règle donc depuis le site, sans intervention sur le crontab.
    pollSeconds: config.pollMinutes * 60,
  });
}
