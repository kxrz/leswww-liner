import Link from "next/link";
import { Footer, Nav } from "./Chrome";
import { Frame } from "./Frame";
import { listVisuals, readStatus, slug } from "@/lib/store";

// Public page: rebuilt at most every ten minutes, so a busy day costs nothing to the frame's storage
export const revalidate = 600;

const SAMPLES = ["balthazar", "bangalter", "magugu", "agnes-obel", "nils-frahm", "the-verve"].map(
  (name) => `/samples/${name}.png`,
);

export default async function Home() {
  const [status, visuals] = await Promise.all([readStatus(), listVisuals()]);
  const current = status ? visuals.get(slug(status.guid)) : undefined;
  const recent = [...visuals.values()].sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")).map((v) => v.url);
  const strip = [...recent, ...SAMPLES].slice(0, 10);

  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="hero">
          <div className="hero-tags">
            <span className="tag tag-live">Project</span>
            <span className="label">A LesWWW project · music from 320kbps.club</span>
          </div>
          <h1>
            Liner, <mark>one track on the wall.</mark>
          </h1>
          <p className="lede">
            An e-ink frame that hangs a single track from <a href="https://www.320kbps.club">320kbps.club</a>, twice a day:
            the cover and its liner notes on a museum label, laid over a map of where the artist comes from.
          </p>
          <div className="actions">
            <Link href="/control" className="btn">Open the control room →</Link>
            <a href="https://github.com/kxrz/leswww-liner" className="btn secondary">Read the code</a>
          </div>
        </section>

        <section className="showcase">
          <Frame src={current?.url ?? SAMPLES[1]} alt={status ? `${status.artist} — ${status.title}` : "Thomas Bangalter on Liner"} />
          {status && (
            <p className="label center">
              On the wall now · <strong>{status.artist}</strong> — {status.title}
              {status.place ? ` · ${status.place}` : ""}
            </p>
          )}
        </section>
      </main>

      <section className="strip" aria-label="Recently on the wall">
        <div className="marquee">
          {[...strip, ...strip].map((src, i) => (
            <Frame key={i} src={src} alt="" small />
          ))}
        </div>
      </section>

      <main className="wrap">
        <section className="block">
          <h2>What hangs on the wall</h2>
          <div className="cards">
            <article className="card">
              <span className="tag">Curated</span>
              <h3>Every track picked by hand</h3>
              <p>Liner reads the 320kbps.club feed, where each track is chosen, listened to and written up by a person, not an algorithm.</p>
            </article>
            <article className="card">
              <span className="tag tag-verified">Located</span>
              <h3>Where the artist comes from</h3>
              <p>Not where they live now: Thomas Bangalter is from Paris. MusicBrainz gives the birthplace, Natural Earth draws the country.</p>
            </article>
            <article className="card">
              <span className="tag">Printed in ink</span>
              <h3>Six inks, no greys</h3>
              <p>Black, white, yellow, red, blue, green. The cover is dithered, the text is never smoothed, and the map takes the cover&apos;s colour.</p>
            </article>
          </div>
        </section>

        <section className="block">
          <h2>How it works</h2>
          <ol className="how">
            <li><span className="label">01</span><p><strong>7:00 and 19:00.</strong> The Raspberry Pi takes the newest track it has not shown yet from 320kbps.club.</p></li>
            <li><span className="label">02</span><p><strong>A map, drawn in the cloud.</strong> Vercel looks up where the artist comes from and renders the map in the panel&apos;s inks.</p></li>
            <li><span className="label">03</span><p><strong>A museum label, drawn on the Pi.</strong> Cover, artist, title, album, label and origin, laid out pixel by pixel.</p></li>
            <li><span className="label">04</span><p><strong>Your turn.</strong> From the control room, skip to the next track, pick any track, or download the picture as a PNG.</p></li>
          </ol>
        </section>

        <section className="block">
          <h2>Hardware</h2>
          <dl className="specs">
            <dt className="label">Computer</dt><dd>Raspberry Pi Zero 2 W</dd>
            <dt className="label">Screen</dt><dd>Pimoroni Inky Impression 7.3&quot; Spectra 6 · 800 × 480 · six inks</dd>
            <dt className="label">Frame</dt><dd>A plain photo frame with a mat</dd>
            <dt className="label">Software</dt><dd>Python and Pillow on the Pi · Next.js and Vercel Blob in the cloud</dd>
            <dt className="label">Data</dt><dd>320kbps.club · MusicBrainz · Natural Earth · OpenStreetMap</dd>
          </dl>
        </section>

        <section className="block maker">
          <div className="maker-head">
            <img src="/florent.png" alt="Florent Bertiaux" width={96} height={96} className="avatar" />
            <div>
              <span className="label">Made by</span>
              <h2 className="name">
                Florent Bertiaux, <mark>creative, curator and geek.</mark>
              </h2>
            </div>
          </div>
          <div className="roles">
            <div>
              <h3>Creative</h3>
              <p>Runs <a href="https://leswww.com">LesWWW</a>, a creative technology studio in Lille. Designed the label, the duotones and the frame.</p>
            </div>
            <div>
              <h3>Curator</h3>
              <p>Picks every track on <a href="https://www.320kbps.club">320kbps.club</a>, a hand-curated music discovery site, one track at a time.</p>
            </div>
            <div>
              <h3>Geek</h3>
              <p>Wired the Pi, the e-ink panel, the maps and the cloud, and opened the code for anyone to build their own.</p>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="cta">
            <h2>Want one on your wall? The code is yours.</h2>
            <p>Liner is open source under the MIT License: a Pi, a Pimoroni panel, a frame, and an afternoon.</p>
            <div className="actions">
              <a href="https://github.com/kxrz/leswww-liner" className="btn accent">Build your own →</a>
              <a href="https://leswww.com/contact" className="btn secondary inverse">Talk to LesWWW</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
