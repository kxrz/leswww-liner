import type { Metadata } from "next";
import { Footer, Nav } from "../Chrome";
import { Ext } from "../Ext";
import { Viewer, type Download } from "./Viewer";
import { galleryJsonLd } from "@/lib/jsonld";
import { SITE } from "@/lib/site";
import { getItems } from "@/lib/feed";
import { listVisuals, readGallery, slug } from "@/lib/store";

export const revalidate = 600;

const TITLE = "Free 4K music wallpapers";
const DESCRIPTION =
  "Free 4K music wallpapers from Liner, the LesWWW e-ink frame: each track's cover, liner notes and a map of where the artist comes from. From 320kbps.club.";
const IMAGE = { url: "/og-gallery.png", width: 1200, height: 630, alt: "Three Liner wallpapers: Thomas Bangalter, Magugu & Le Motel, Balthazar" };

// A child page replaces the parent's whole openGraph and twitter objects: spell them out
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/gallery" },
  openGraph: {
    type: "website",
    url: "/gallery",
    siteName: "Liner · LesWWW",
    locale: "en_GB",
    title: `${TITLE} · Liner`,
    description: DESCRIPTION,
    images: [IMAGE],
  },
  twitter: { card: "summary_large_image", title: `${TITLE} · Liner`, description: DESCRIPTION, images: [IMAGE.url] },
};

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

export default async function Gallery() {
  const [gallery, pictures, items] = await Promise.all([readGallery(), listVisuals(), getItems()]);
  const known = new Map(gallery.map((h) => [h.slug, h]));
  // Tracks drawn before the gallery index existed: their names come from the feed
  for (const item of items) {
    const key = slug(item.guid);
    if (!known.has(key) && pictures.has(key)) {
      known.set(key, { slug: key, guid: item.guid, title: item.title, artist: item.artist, at: pictures.get(key)?.eink?.uploadedAt ?? "" });
    }
  }
  const entries = [...known.values()]
    .filter((h) => pictures.get(h.slug)?.eink)
    .sort((a, b) => b.at.localeCompare(a.at));
  // Dates help only when they differ (tracks seeded the same day all share one)
  const dates = new Set(entries.map((h) => (h.at ? date.format(new Date(h.at)) : "")));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            galleryJsonLd(
              entries.flatMap((h) => {
                const p = pictures.get(h.slug);
                return p?.hd && p.eink
                  ? [{ name: `${h.artist} — ${h.title}`, contentUrl: p.hd.url, thumbnailUrl: p.eink.url, isBasedOn: h.guid }]
                  : [];
              }),
            ),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <Nav current="gallery" />
      <main id="main" tabIndex={-1}>
        <div className="wrap">
          <section className="hero compact">
            <div className="hero-tags">
              <span className="tag tag-live">Gallery</span>
              <span className="label">A selection · {entries.length} tracks · free to download</span>
            </div>
            <h1>
              Free 4K music wallpapers, <mark>straight from the wall.</mark>
            </h1>
            <p className="lede">
              A selection of the tracks Liner has shown, in three versions: a 4K wallpaper, the colour e-ink picture
              and its black and white twin. Hundreds more are waiting on <Ext href={SITE.music}>320kbps.club</Ext>.
            </p>
          </section>

          <Viewer
            entries={entries.map((h) => {
              const p = pictures.get(h.slug) ?? {};
              return {
                slug: h.slug,
                guid: h.guid,
                title: h.title,
                artist: h.artist,
                place: h.place,
                date: dates.size > 1 && h.at ? date.format(new Date(h.at)) : undefined,
                eink: p.eink?.url ?? "",
                downloads: [
                  p.hd && { label: "4K", what: "4K wallpaper", url: p.hd.downloadUrl, primary: true },
                  p.eink && { label: "E-ink", what: "e-ink picture", url: p.eink.downloadUrl },
                  p.bw && { label: "B&W", what: "black and white picture", url: p.bw.downloadUrl },
                ].filter((d): d is Download => Boolean(d)),
              };
            })}
          />

          <section className="block" aria-labelledby="more">
            <div className="cta">
              <h2 id="more">This is only a selection.</h2>
              <p>Every track on the wall comes from 320kbps.club, where hundreds more are picked by hand, one at a time.</p>
              <div className="actions">
                <Ext href={SITE.music} className="btn inverse">Listen to more on 320kbps.club <span aria-hidden="true">→</span></Ext>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
