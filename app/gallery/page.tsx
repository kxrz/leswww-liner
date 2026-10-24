import type { Metadata } from "next";
import { Footer, Nav } from "../Chrome";
import { Viewer } from "./Viewer";
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

  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="hero compact">
          <div className="hero-tags">
            <span className="tag tag-live">Gallery</span>
            <span className="label">A selection · {entries.length} tracks · free to download</span>
          </div>
          <h1>
            A selection from the wall, <mark>as wallpapers.</mark>
          </h1>
          <p className="lede">
            Some of the tracks Liner has shown, in three versions: a 4K wallpaper, the colour e-ink picture and its
            black and white twin. Hundreds more are waiting on <a href="https://www.320kbps.club">320kbps.club</a>.
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
              date: h.at ? date.format(new Date(h.at)) : undefined,
              eink: p.eink?.url ?? "",
              downloads: [
                p.hd && { label: "4K ↓", url: p.hd.downloadUrl, primary: true },
                p.eink && { label: "E-ink ↓", url: p.eink.downloadUrl },
                p.bw && { label: "B&W ↓", url: p.bw.downloadUrl },
              ].filter((d): d is { label: string; url: string; primary?: boolean } => Boolean(d)),
            };
          })}
        />
        <section className="block">
          <div className="cta">
            <h2>This is only a selection.</h2>
            <p>Every track on the wall comes from 320kbps.club, where hundreds more are picked by hand, one at a time.</p>
            <div className="actions">
              <a href="https://www.320kbps.club" className="btn accent">Listen to more on 320kbps.club →</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
