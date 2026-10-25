import type { Metadata } from "next";
import { login, send, setSource } from "../actions";
import { Footer, Nav } from "../Chrome";
import { NowPlaying } from "../NowPlaying";
import { Tracks } from "../Tracks";
import { isLoggedIn } from "@/lib/auth";
import { getItems } from "@/lib/feed";
import { STALE_MINUTES } from "@/lib/frame";
import { ago, frameState } from "@/lib/health";
import { listSources, SITE_FEED } from "@/lib/sources";
import { listVisuals, readCommand, readHealth, readSettings, readStatus, slug } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control room", robots: { index: false, follow: false } };

export default async function Control({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  if (!(await isLoggedIn())) {
    return (
      <>
        <Nav current="control" />
        <main id="main" tabIndex={-1} className="wrap narrow">
          <section className="hero compact">
            <div className="hero-tags">
              <span className="tag tag-live">Control room</span>
              <span className="label">Liner · a LesWWW project</span>
            </div>
            <h1>
              Change the track, <mark>from your phone.</mark>
            </h1>
          </section>
          <form action={login} className="login">
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={params.wrong ? true : undefined}
              aria-describedby={params.wrong ? "password-error" : undefined}
            />
            {params.wrong && <p id="password-error" role="alert" className="form-error">Error: wrong password.</p>}
            <button type="submit" className="btn">Enter <span aria-hidden="true">→</span></button>
          </form>
        </main>
        <Footer />
      </>
    );
  }

  const settings = await readSettings();
  const feed = settings?.feed ?? SITE_FEED.url;
  const [items, status, command, visuals, health, sources] = await Promise.all([
    getItems(feed), readStatus(), readCommand(), listVisuals(), readHealth(), listSources(),
  ]);
  const frame = frameState(health);
  const requested = Math.max(Number(params.sent) || 0, command?.id ?? 0);
  const waiting = requested > (status?.command ?? 0);
  // A request never picked up stops locking the page after a while (the frame may be asleep or offline)
  const fresh = Date.now() - requested < STALE_MINUTES * 60_000;
  const pending = waiting && fresh ? requested : null;
  const asked = command?.action === "show" ? items.find((i) => i.guid === command.guid) : undefined;
  const what = {
    show: asked ? `${asked.artist} — ${asked.title}` : "The track you picked",
    next: "The next track of the feed",
    refresh: status ? `A redraw of ${status.artist} — ${status.title}` : "A redraw",
  }[command?.action ?? "next"];
  const away = { asleep: "the frame is asleep, it wakes at 7:00", silent: "the frame has gone silent, when it is back", online: undefined, unknown: undefined }[frame.state];

  return (
    <>
      <Nav current="control" />
      <main id="main" tabIndex={-1} className="wrap narrow">
        <h1 className="sr-only">Control room</h1>
        <div className="health">
          {frame.state === "online" && <span className="tag tag-verified">Online</span>}
          {frame.state === "silent" && <span className="tag tag-alert">Silent</span>}
          {frame.state === "asleep" && <span className="tag">Asleep until 7:00</span>}
          {frame.state === "unknown" && <span className="tag">No news yet</span>}
          <span className="label">
            {[
              frame.minutes !== null && `checked in ${ago(frame.minutes)}`,
              health?.temp !== undefined && `${health.temp.toFixed(0)} °C`,
              health?.uptime !== undefined && `up ${ago(Math.round(health.uptime / 60)).replace(" ago", "")}`,
              health?.version && `v ${health.version}`,
            ].filter(Boolean).join(" · ")}
          </span>
        </div>
        <NowPlaying
          status={status}
          pictures={status ? visuals.get(slug(status.guid)) : undefined}
          pending={pending}
          requested={what}
          away={away}
          done={!!status && Number(params.done) === status.command}
          stale={waiting && !fresh}
        />

        <form action={send} className="actions">
          <button name="action" value="next" className="btn" disabled={!!pending}>Next track <span aria-hidden="true">→</span></button>
          <button name="action" value="refresh" className="btn secondary" disabled={!!pending}>Redraw</button>
        </form>

        <h2 className="list-title">Pick a track</h2>
        <Tracks
          tracks={items.map((item) => {
            const pics = visuals.get(slug(item.guid)) ?? {};
            return {
              guid: item.guid, title: item.title, artist: item.artist, album: item.album, cover: item.cover,
              eink: pics.eink?.downloadUrl, hd: pics.hd?.downloadUrl,
            };
          })}
          current={status?.guid}
          locked={!!pending}
        />

        <h2 className="list-title">Source</h2>
        <form action={setSource} className="source">
          <label htmlFor="feed" className="label">RSS feed the frame follows</label>
          <input
            id="feed"
            type="url"
            name="feed"
            defaultValue={feed}
            list="sources"
            required
            autoComplete="url"
            placeholder="https://…/feed.xml"
            aria-invalid={params.source === "invalid" ? true : undefined}
            aria-describedby="feed-note"
          />
          <datalist id="sources">
            {sources.flatMap((g) => g.sources).map((source) => (
              <option key={source.url} value={source.url} label={source.label} />
            ))}
          </datalist>
          <button type="submit" className="btn secondary">Follow</button>
          {feed !== SITE_FEED.url && (
            <button type="submit" name="reset" value="1" formNoValidate className="btn secondary">Reset</button>
          )}
        </form>
        <p id="feed-note" className={params.source === "invalid" ? "form-error source-note" : "label source-note"} role={params.source ? "status" : undefined}>
          {{
            saved: "Saved. The frame picks it up within a minute; the next track comes from this feed.",
            reset: "Back to the whole of 320kbps.club.",
            invalid: "Error: that address is not an RSS feed with tracks in it.",
          }[params.source] ?? `Following: ${settings?.feedLabel ?? SITE_FEED.label}. Curators and playlists are suggested as you type.`}
        </p>
      </main>
      <Footer />
    </>
  );
}
