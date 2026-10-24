import { login, send } from "./actions";
import { NowPlaying } from "./NowPlaying";
import { isLoggedIn } from "@/lib/auth";
import { getItems, type Item } from "@/lib/feed";
import { listVisuals, readCommand, readStatus, slug } from "@/lib/store";

export const dynamic = "force-dynamic";

function Cover({ item, size }: { item?: Item; size: number }) {
  return item?.cover ? <img src={item.cover} alt="" width={size} height={size} className="cover" /> : <div className="cover" style={{ width: size, height: size }} />;
}

function Header() {
  return (
    <header>
      <h1>Liner</h1>
      <a href="https://leswww.com" className="mono">a LesWWW project</a>
    </header>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  if (!(await isLoggedIn())) {
    return (
      <main>
        <Header />
        <p className="lede">An e-ink frame that hangs one track from 320kbps.club at a time, like a work in a museum.</p>
        <form action={login} className="login">
          <input type="password" name="password" placeholder="Password" autoFocus required />
          <button type="submit">Enter</button>
        </form>
        {params.wrong && <p className="note">Wrong password.</p>}
      </main>
    );
  }

  const [items, status, command, visuals] = await Promise.all([getItems(), readStatus(), readCommand(), listVisuals()]);
  const requested = Math.max(Number(params.sent) || 0, command?.id ?? 0);
  const pending = requested > (status?.command ?? 0) ? requested : null;

  return (
    <main>
      <Header />

      <NowPlaying status={status} visual={status ? visuals.get(slug(status.guid)) : undefined} pending={pending} />

      <form action={send} className="actions">
        <button name="action" value="next" disabled={!!pending}>Next track</button>
        <button name="action" value="refresh" className="secondary" disabled={!!pending}>Redraw</button>
      </form>

      <h2 className="mono label">Pick a track</h2>
      <ul className="list">
        {items.map((item) => {
          const visual = visuals.get(slug(item.guid));
          return (
            <li key={item.guid} className={item.guid === status?.guid ? "current" : undefined}>
              <form action={send}>
                <input type="hidden" name="guid" value={item.guid} />
                <button name="action" value="show" className="row" disabled={!!pending}>
                  <Cover item={item} size={52} />
                  <span>
                    <span className="title">{item.title}</span>
                    <span className="artist">{item.artist}{item.album && <em> · album</em>}</span>
                  </span>
                </button>
              </form>
              {visual && <a href={visual.downloadUrl} className="download small" aria-label={`Download the picture for ${item.title}`}>PNG</a>}
            </li>
          );
        })}
      </ul>

      <section className="about">
        <h2 className="mono label">About</h2>
        <p>
          <strong>Liner</strong> hangs one track from <a href="https://www.320kbps.club">320kbps.club</a> on the wall at a
          time, twice a day: the cover and its liner notes on a museum-style label, laid over a map of where the artist
          comes from. A <a href="https://leswww.com">LesWWW</a> project.
        </p>
        <dl>
          <dt>Computer</dt><dd>Raspberry Pi Zero 2 W</dd>
          <dt>Screen</dt><dd>Pimoroni Inky Impression 7.3&quot; Spectra 6 · 800 × 480 · six inks</dd>
          <dt>Refresh</dt><dd>7:00 and 19:00, or from this page</dd>
          <dt>Music</dt><dd>320kbps.club</dd>
          <dt>Maps</dt><dd>Natural Earth · MusicBrainz · OpenStreetMap</dd>
        </dl>
        <p className="mono">
          <a href="https://github.com/kxrz/leswww-liner">Source on GitHub</a> · <a href="https://leswww.com">leswww.com</a>
        </p>
      </section>
    </main>
  );
}
