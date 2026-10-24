import type { Metadata } from "next";
import { login, send } from "../actions";
import { Footer, Nav } from "../Chrome";
import { NowPlaying } from "../NowPlaying";
import { isLoggedIn } from "@/lib/auth";
import { getItems } from "@/lib/feed";
import { listVisuals, readCommand, readStatus, slug } from "@/lib/store";

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
            <p className="eyebrow">Control room</p>
            <h1>
              Change the track,<br />
              <em>from your phone.</em>
            </h1>
          </section>
          <form action={login} className="card login">
            <input type="password" name="password" placeholder="Password" autoFocus required />
            <button type="submit" className="pill">Enter</button>
            {params.wrong && <p className="meta">Wrong password.</p>}
          </form>
        </main>
        <Footer />
      </>
    );
  }

  const [items, status, command, visuals] = await Promise.all([getItems(), readStatus(), readCommand(), listVisuals()]);
  const requested = Math.max(Number(params.sent) || 0, command?.id ?? 0);
  const pending = requested > (status?.command ?? 0) ? requested : null;

  return (
    <>
      <Nav control />
      <main className="wrap narrow">
        <NowPlaying status={status} visual={status ? visuals.get(slug(status.guid)) : undefined} pending={pending} />

        <form action={send} className="actions">
          <button name="action" value="next" className="pill" disabled={!!pending}>Next track</button>
          <button name="action" value="refresh" className="pill muted" disabled={!!pending}>Redraw</button>
        </form>

        <h2 className="eyebrow list-title">Pick a track</h2>
        <ul className="tracks">
          {items.map((item) => {
            const visual = visuals.get(slug(item.guid));
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
                {visual && <a href={visual.downloadUrl} className="pill muted tiny" aria-label={`Download the picture for ${item.title}`}>PNG</a>}
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
