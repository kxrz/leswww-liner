import type { Metadata } from "next";
import { login, send, setSource } from "../actions";
import { Footer, Nav } from "../Chrome";
import { NowPlaying } from "../NowPlaying";
import { isLoggedIn } from "@/lib/auth";
import { getItems } from "@/lib/feed";
import { ago, frameState } from "@/lib/health";
import { listSources, SITE_FEED } from "@/lib/sources";
import { listVisuals, readCommand, readHealth, readSettings, readStatus, slug } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control room · Liner", robots: { index: false, follow: false } };

export default async function Control({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  if (!(await isLoggedIn())) {
    return (
      <>
        <Nav control />
        <main className="wrap narrow">
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
            <input type="password" name="password" placeholder="Password" autoFocus required />
            <button type="submit" className="btn">Enter →</button>
            {params.wrong && <p className="label">Wrong password.</p>}
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
  const pending = requested > (status?.command ?? 0) ? requested : null;

  return (
    <>
      <Nav control />
      <main className="wrap narrow">
        <div className="health">
          {frame.state === "online" && <span className="tag tag-live">Online</span>}
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
        <NowPlaying status={status} pictures={status ? visuals.get(slug(status.guid)) : undefined} pending={pending} />

        <form action={send} className="actions">
          <button name="action" value="next" className="btn" disabled={!!pending}>Next track →</button>
          <button name="action" value="refresh" className="btn secondary" disabled={!!pending}>Redraw</button>
        </form>

        <h2 className="list-title">Source</h2>
        <form action={setSource} className="source">
          <input
            type="url"
            name="feed"
            defaultValue={feed}
            list="sources"
            required
            aria-label="RSS feed the frame follows"
            placeholder="https://…/feed.xml"
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
        <p className="label source-note">
          {{
            saved: "Saved. The frame picks it up within a minute; the next track comes from this feed.",
            reset: "Back to the whole of 320kbps.club.",
            invalid: "That address is not an RSS feed with tracks in it.",
          }[params.source] ?? `Following: ${settings?.feedLabel ?? SITE_FEED.label}. Curators and playlists are suggested as you type.`}
        </p>

        <h2 className="list-title">Pick a track</h2>
        <ul className="tracks">
          {items.map((item) => {
            const pics = visuals.get(slug(item.guid)) ?? {};
            return (
              <li key={item.guid} className={item.guid === status?.guid ? "current" : undefined}>
                <form action={send}>
                  <input type="hidden" name="guid" value={item.guid} />
                  <button name="action" value="show" className="row" disabled={!!pending}>
                    {item.cover ? <img src={item.cover} alt="" width={52} height={52} className="cover" /> : <span className="cover" />}
                    <span>
                      <span className="track-title">{item.title}</span>
                      <span className="track-artist">{item.artist}{item.album && <em> · album</em>}</span>
                    </span>
                  </button>
                </form>
                {pics.eink && <a href={pics.eink.downloadUrl} className="tag download" aria-label={`Download the e-ink picture for ${item.title}`}>PNG</a>}
                {pics.hd && <a href={pics.hd.downloadUrl} className="tag download" aria-label={`Download the 4K wallpaper for ${item.title}`}>4K</a>}
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
