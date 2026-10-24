import Link from "next/link";
import { Footer, Nav } from "./Chrome";
import { Compare } from "./Compare";
import { Ext } from "./Ext";
import { Frame } from "./Frame";
import { Marquee } from "./Marquee";
import { landingJsonLd } from "@/lib/jsonld";
import { PARTS, SITE } from "@/lib/site";
import { listVisuals, readStatus, slug } from "@/lib/store";

// Public page: rebuilt at most every ten minutes, so a busy day costs nothing to the frame's storage
export const revalidate = 600;

const SAMPLES = ["balthazar", "bangalter", "magugu", "agnes-obel", "nils-frahm", "the-verve"].map(
  (name) => `/samples/${name}.png`,
);

const FAQ = [
  {
    q: "What is Liner?",
    a: "A picture frame with a colour e-ink panel that shows one music track at a time, twice a day, like a work in a museum: the cover and its liner notes on a label, over a map of where the artist comes from.",
  },
  {
    q: "Where do the tracks come from?",
    a: "From 320kbps.club, where every track is picked by hand. The frame can follow the whole site, a curator, a playlist, or any other RSS feed with covers.",
  },
  {
    q: "How does it know where the artist comes from?",
    a: "MusicBrainz gives where an artist was born or formed, not where they live now: Thomas Bangalter is from Paris, even if he lives in Beverly Hills. A track whose origin cannot be found is never shown.",
  },
  {
    q: "Does it work on a black and white e-ink panel?",
    a: "Yes. Every picture also exists in two inks: the cover becomes a 1-bit dither, the map a line drawing.",
  },
  {
    q: "Is there a subscription?",
    a: "No. The code is open source under the MIT License, the maps use free open data, and the wallpapers are free to download.",
  },
  {
    q: "Can I buy one ready-made?",
    a: "Not at the moment: the parts cost about €100 with the deals (€120 otherwise), the build guide is free and it takes about an afternoon. For something made to measure, talk to LesWWW.",
  },
];

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
  const nowAlt = status
    ? `Liner showing ${status.artist} — ${status.title}${status.place ? `, over a map of ${status.place}` : ""}`
    : "Liner showing Thomas Bangalter, over a map of Paris, France";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()) }} />
      <Nav current="home" />
      <main id="main" tabIndex={-1}>
        <div className="wrap">
          {/* AIDA: the picture and the headline catch the eye, the lede explains, the list makes you want one, the buttons act */}
          <section className="hero hero-split">
            <div className="hero-copy">
              <div className="hero-tags">
                <Ext href={SITE.studio} className="tag tag-live">A LesWWW project</Ext>
                <span className="label">E-ink music frame · music from 320kbps.club</span>
              </div>
              <h1>
                Liner: one track on your wall, <mark>like a work in a museum.</mark>
              </h1>
              <p className="lede">
                An e-ink frame that hangs a single track from <Ext href={SITE.music}>320kbps.club</Ext>, twice a day: its
                cover and liner notes on a museum label, over a map of where the artist comes from.
              </p>
              <ul className="perks">
                <li>Picked by a curator, never an algorithm</li>
                <li>Where the artist comes from, mapped</li>
                <li>A free 4K wallpaper of every track</li>
                <li>Open source: a Pi, a panel, an afternoon</li>
              </ul>
              <div className="actions">
                <Ext href={SITE.build} className="btn">Build your own <span aria-hidden="true">→</span></Ext>
                <Link href="/gallery" className="btn secondary">Get the wallpapers</Link>
              </div>
            </div>
            <figure className="hero-frame">
              <Frame src={current?.eink?.url ?? SAMPLES[1]} alt={nowAlt} priority />
              {status && (
                <figcaption className="label">
                  <span className="tag tag-verified">On the wall now</span> <strong>{status.artist}</strong> — {status.title}
                  {status.place ? ` · ${status.place}` : ""}
                </figcaption>
              )}
            </figure>
          </section>
        </div>

        <Marquee pictures={[...recent, ...SAMPLES].slice(0, 10)} />

        <div className="wrap">
          <section className="block" aria-labelledby="prepared">
            <h2 id="prepared">Prepared for e-ink</h2>
            <p className="block-lede">
              Every track is drawn twice. Once in full definition, then once for the panel&apos;s six inks (black, white,
              yellow, red, blue, green): a dithered cover, text without smoothing, a map that snaps to the pixel.
            </p>
            <Compare hd={art.hd} eink={art.eink} alt={art.alt} />
            <div className="duo">
              <div>
                <Frame src={art.bw} alt={`${art.alt}, in black and white`} />
              </div>
              <div className="duo-text">
                <h3>In black and white</h3>
                <p>
                  The same picture in two inks, for black and white e-ink panels: the cover becomes a 1-bit dither, the
                  map a line drawing.
                </p>
                <h3>As a 4K wallpaper</h3>
                <p>The HD drawing, 3840 × 2160, in the tones of the panel. A new one every time the frame changes.</p>
                <a href={art.hdDownload} className="text-link" download>
                  Download today&apos;s 4K wallpaper<span className="sr-only">: {art.alt}</span>
                </a>
              </div>
            </div>
          </section>

          <section className="block" id="how" aria-labelledby="how-title">
            <h2 id="how-title">How it works</h2>
            <ol className="how">
              <li><span className="label">01</span><p><strong>7:00 and 19:00.</strong> The Raspberry Pi takes the newest track it has not shown yet from 320kbps.club, or from any feed you choose.</p></li>
              <li><span className="label">02</span><p><strong>A map, drawn in the cloud.</strong> Vercel looks up where the artist comes from and renders the map in the panel&apos;s inks.</p></li>
              <li><span className="label">03</span><p><strong>A museum label, drawn on the Pi.</strong> Cover, artist, title, album, label and origin, laid out pixel by pixel.</p></li>
              <li><span className="label">04</span><p><strong>Your turn.</strong> From the <Link href="/control" rel="nofollow">control room</Link> on your phone, skip to the next track, pick any track or feed, or download the pictures.</p></li>
            </ol>
          </section>

          <section className="block" id="control-room" aria-labelledby="control-title">
            <h2 id="control-title">From your phone</h2>
            <p className="block-lede">
              A control room that fits in a pocket: what is on the wall and whether the frame is online, the next track
              or any track you like, another feed to follow, and every picture to download.
            </p>
            <div className="phones">
              {[
                { src: "now", caption: "What hangs on the wall, and the frame's health", alt: "Control room on a phone: the frame is online, CZARFACE & Frankie Pulitzer on the wall, download buttons, Next track and Redraw" },
                { src: "request", caption: "A request on its way, step by step", alt: "Control room on a phone: a request is on its way; request sent, frame picks it up, e-ink redraw" },
                { src: "tracks", caption: "Any track from the feed, any time", alt: "Control room on a phone: a list of tracks with their covers, each with PNG and 4K downloads" },
              ].map((shot) => (
                <figure key={shot.src} className="phone">
                  <img src={`/control/${shot.src}.webp`} alt={shot.alt} width={585} height={1266} loading="lazy" decoding="async" />
                  <figcaption className="label">{shot.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="block" id="build" aria-labelledby="build-title">
            <h2 id="build-title">Build it</h2>
            <p className="block-lede">
              Parts for {PARTS.cost}, and an afternoon. No soldering, no subscription.
            </p>
            <dl className="specs">
              <dt className="label">Computer</dt>
              <dd><Ext href={PARTS.pi} sponsored>Raspberry Pi Zero 2 WH</Ext>, with its header soldered</dd>
              <dt className="label">Screen</dt>
              <dd><Ext href={PARTS.panel} sponsored>Pimoroni Inky Impression 7.3&quot; Spectra 6</Ext> · 800 × 480 · six inks</dd>
              <dt className="label">Frame</dt><dd>A plain photo frame with a mat, a microSD card and a 5 V power supply</dd>
              <dt className="label">Software</dt><dd>Python and Pillow on the Pi · Next.js and Vercel Blob in the cloud, both open source</dd>
              <dt className="label">Data</dt><dd>320kbps.club · MusicBrainz · Natural Earth · OpenStreetMap</dd>
            </dl>
            <p className="label disclosure">
              The Raspberry Pi and Pimoroni links are affiliate links: buying through them supports the project at no
              extra cost to you.
            </p>
            <div className="actions">
              <Ext href={SITE.build} className="btn">Read the build guide <span aria-hidden="true">→</span></Ext>
              <Ext href={SITE.repo} className="btn secondary">Source on GitHub</Ext>
            </div>
          </section>

          <section className="block" aria-labelledby="faq-title">
            <h2 id="faq-title">Questions</h2>
            <div className="faq">
              {FAQ.map(({ q, a }) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="block maker" aria-labelledby="maker-title">
            <div className="maker-head">
              <img src="/florent.webp" alt="" width={96} height={96} className="avatar" />
              <div>
                <span className="label">Made by</span>
                <h2 id="maker-title">Florent Bertiaux, creative, curator and geek</h2>
              </div>
            </div>
            <div className="roles">
              <div>
                <h3>Creative</h3>
                <p>Runs <Ext href={SITE.studio}>LesWWW</Ext>, a creative technology studio in Lille. Designed the label, the duotones and the frame.</p>
              </div>
              <div>
                <h3>Curator</h3>
                <p>Picks every track on <Ext href={SITE.music}>320kbps.club</Ext>, a hand-curated music discovery site, one track at a time.</p>
              </div>
              <div>
                <h3>Geek</h3>
                <p>Wired the Pi, the e-ink panel, the maps and the cloud, and opened the code for anyone to build their own.</p>
              </div>
            </div>
          </section>

          <section className="block" aria-labelledby="cta-title">
            <div className="cta">
              <h2 id="cta-title">Want one on your wall? The code is yours.</h2>
              <p>Liner is open source under the MIT License: a Pi, a Pimoroni panel, a frame, and an afternoon.</p>
              <div className="actions">
                <Ext href={SITE.build} className="btn inverse">Build your own <span aria-hidden="true">→</span></Ext>
              </div>
              <p className="cta-aside">
                Something made to measure? <Ext href={SITE.contact}>Talk to LesWWW</Ext>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
