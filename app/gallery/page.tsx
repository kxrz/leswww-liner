import type { Metadata } from "next";
import { Footer, Nav } from "../Chrome";
import { getItems } from "@/lib/feed";
import { listVisuals, readGallery, slug } from "@/lib/store";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Gallery: free 4K music wallpapers",
  description:
    "Every track that has hung on Liner, the LesWWW e-ink frame: free 4K wallpapers, e-ink and black and white versions, each with a map of where the artist comes from. Music from 320kbps.club.",
  alternates: { canonical: "/gallery" },
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
        <section className="hero">
          <div className="hero-tags">
            <span className="tag tag-live">Gallery</span>
            <span className="label">{entries.length} tracks · free to download</span>
          </div>
          <h1>
            Everything that hung on the wall, <mark>as wallpapers.</mark>
          </h1>
          <p className="lede">
            Each track Liner has shown, in three versions: a 4K wallpaper, the colour e-ink picture and its black and
            white twin. Music picked on <a href="https://www.320kbps.club">320kbps.club</a>.
          </p>
        </section>

        <ul className="gallery">
          {entries.map((h) => {
            const p = pictures.get(h.slug) ?? {};
            return (
              <li key={h.slug} className="card">
                <a href={p.hd?.url ?? p.eink?.url} className="thumb">
                  <img src={p.eink?.url} alt={`${h.artist} — ${h.title}, on Liner`} loading="lazy" width={800} height={480} />
                </a>
                <div>
                  <p className="track-artist">{h.artist}</p>
                  <a href={h.guid} className="track-title">{h.title}</a>
                  <p className="label">{[h.place, h.at && date.format(new Date(h.at))].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="downloads">
                  {p.hd && <a href={p.hd.downloadUrl} className="btn small">4K ↓</a>}
                  {p.eink && <a href={p.eink.downloadUrl} className="btn secondary small">E-ink ↓</a>}
                  {p.bw && <a href={p.bw.downloadUrl} className="btn secondary small">B&amp;W ↓</a>}
                  <a href={h.guid} className="btn secondary small">Listen on 320kbps.club →</a>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
