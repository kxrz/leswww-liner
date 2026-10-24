import Link from "next/link";
import { Footer, Nav } from "./Chrome";
import { Compare } from "./Compare";
import { Frame } from "./Frame";
import { landingJsonLd } from "@/lib/jsonld";
import { listVisuals, readStatus, slug } from "@/lib/store";

// Public page: rebuilt at most every ten minutes, so a busy day costs nothing to the frame's storage
export const revalidate = 600;

const SAMPLES = ["balthazar", "bangalter", "magugu", "agnes-obel", "nils-frahm", "the-verve"].map(
  (name) => `/samples/${name}.png`,
);

export default async function Home() {
  const [status, visuals] = await Promise.all([readStatus(), listVisuals()]);
  const current = status ? visuals.get(slug(status.guid)) : undefined;
  const recent = [...visuals.values()]
    .flatMap((p) => (p.eink ? [p.eink] : []))
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""))
    .map((v) => v.url);
  // The before/after needs all three pictures of one track; until the frame has made them, show the sample
  const full = current?.eink && current.hd && current.bw ? current : null;
  const art = {
    eink: full?.eink?.url ?? SAMPLES[1],
    hd: full?.hd?.url ?? "/samples/bangalter-4k.jpg",
    bw: full?.bw?.url ?? "/samples/bangalter-bw.png",
    hdDownload: full?.hd?.downloadUrl ?? "/samples/bangalter-4k.jpg",
    alt: full && status ? `${status.artist} — ${status.title}` : "Thomas Bangalter — Mythologies: XIX. Circonvolutions",
  };
  const strip = [...recent, ...SAMPLES].slice(0, 10);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()) }} />
      <Nav />
      <main className="wrap">
        {/* AIDA: the picture and the headline catch the eye, the lede explains, the list makes you want one, the buttons act */}
        <section className="hero hero-split">
          <div className="hero-copy">
            <div className="hero-tags">
              <a href="https://www.leswww.com" className="tag tag-live">A LesWWW project</a>
              <span className="label">Music from 320kbps.club</span>
            </div>
            <h1>
              One track on your wall, <mark>like a work in a museum.</mark>
            </h1>
            <p className="lede">
              Liner is an e-ink frame that hangs a single track from <a href="https://www.320kbps.club">320kbps.club</a>,
              twice a day: its cover and liner notes on a museum label, over a map of where the artist comes from.
            </p>
            <ul className="perks">
              <li>Picked by a curator, never an algorithm</li>
              <li>Where the artist comes from, mapped</li>
              <li>A free 4K wallpaper of every track</li>
              <li>Open source: a Pi, a panel, an afternoon</li>
            </ul>
            <div className="actions">
              <a href="https://github.com/kxrz/leswww-liner/blob/main/docs/BUILD.md" className="btn">Build your own →</a>
              <Link href="/gallery" className="btn secondary">Get the wallpapers</Link>
            </div>
          </div>
          <figure className="hero-frame">
            <Frame src={current?.eink?.url ?? SAMPLES[1]} alt={status ? `${status.artist} — ${status.title}` : "Thomas Bangalter on Liner"} />
            {status && (
              <figcaption className="label">
                <span className="tag tag-live">On the wall now</span> <strong>{status.artist}</strong> — {status.title}
                {status.place ? ` · ${status.place}` : ""}
              </figcaption>
            )}
          </figure>
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
          <h2>Prepared for e-ink</h2>
          <p className="block-lede">
            Every track is drawn twice. Once in full definition, then once for the panel: six inks, a dithered cover,
            text without smoothing, a map that snaps to the pixel. Drag to compare.
          </p>
          <Compare hd={art.hd} eink={art.eink} alt={art.alt} />
          <div className="duo">
            <div>
              <Frame src={art.bw} alt={`${art.alt}, black and white`} />
            </div>
            <div className="duo-text">
              <span className="tag">Mono panels too</span>
              <h3>In black and white</h3>
              <p>
                The same picture in two inks, for black and white e-ink panels: the cover becomes a 1-bit dither, the map
                a line drawing.
              </p>
              <span className="tag tag-live">Wallpaper</span>
              <h3>As a 4K wallpaper</h3>
              <p>The HD drawing, 3840 × 2160, in the tones of the panel. A new one every time the frame changes.</p>
              <div className="actions tight">
                <a href={art.hdDownload} className="btn">Today&apos;s 4K wallpaper ↓</a>
                <Link href="/gallery" className="btn secondary">More wallpapers →</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="block" id="how">
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
            <img src="/florent.webp" alt="Florent Bertiaux" width={96} height={96} className="avatar" />
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
              <a href="https://github.com/kxrz/leswww-liner/blob/main/docs/BUILD.md" className="btn accent">Build your own →</a>
              <a href="https://leswww.com/contact" className="btn secondary inverse">Talk to LesWWW</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
