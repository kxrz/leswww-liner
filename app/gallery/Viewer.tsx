"use client";

import { useEffect, useRef, useState } from "react";
import { Ext } from "../Ext";
import { Frame } from "../Frame";

export type Download = { label: string; what: string; url: string; primary?: boolean };

export type Entry = {
  slug: string; guid: string; title: string; artist: string; place?: string; date?: string;
  eink: string; downloads: Download[];
};

const describe = (e: Entry) => `${e.artist} — ${e.title}`;
const alt = (e: Entry) =>
  `Liner label for ${describe(e)}${e.place ? `, over a map of ${e.place}` : ""}`;

function Downloads({ entry, featured }: { entry: Entry; featured?: boolean }) {
  return (
    <div className="downloads">
      {entry.downloads.map((d) => (
        <a key={d.label} href={d.url} download className={featured && d.primary ? "btn small" : "btn secondary small"}>
          {d.label}
          <span className="sr-only">: download the {d.what} of {describe(entry)}</span>
          <span aria-hidden="true"> ↓</span>
        </a>
      ))}
    </div>
  );
}

/** The gallery: one picture large in the frame, every other one below. Click to hang it; the URL hash keeps it. */
export function Viewer({ entries }: { entries: Entry[] }) {
  const [current, setCurrent] = useState(entries[0]?.slug);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const fromHash = (move: boolean) => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      if (!entries.some((e) => e.slug === slug)) return;
      setCurrent(slug);
      if (move) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("frame")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        heading.current?.focus({ preventScroll: true }); // keyboard users land on what they picked
      }
    };
    fromHash(false);
    const onHash = () => fromHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [entries]);

  const shown = entries.find((e) => e.slug === current) ?? entries[0];
  if (!shown) return <p className="label">Nothing has hung on the wall yet.</p>;

  return (
    <>
      <section className="featured" id="frame" aria-labelledby="featured-title">
        <Frame src={shown.eink} alt={alt(shown)} priority />
        <div className="featured-text">
          <span className="label">In the frame</span>
          <h2 id="featured-title" ref={heading} tabIndex={-1} className="track-heading">
            <span className="track-artist">{shown.artist}</span>
            <span className="track-title">{shown.title}</span>
          </h2>
          <p className="label">{[shown.place, shown.date].filter(Boolean).join(" · ")}</p>
          <Downloads entry={shown} featured />
          <Ext href={shown.guid} className="text-link">
            Listen to {describe(shown)} on 320kbps.club
          </Ext>
        </div>
      </section>

      <h2 className="list-title">All the wallpapers</h2>
      <ul className="gallery">
        {entries.map((e) => (
          <li key={e.slug} className={e.slug === shown.slug ? "card current" : "card"}>
            <a href={`#${e.slug}`} className="thumb" aria-current={e.slug === shown.slug ? "true" : undefined}>
              <img src={e.eink} alt={alt(e)} loading="lazy" decoding="async" width={800} height={480} />
              <span className="sr-only">: show it in the frame</span>
            </a>
            <h3 className="track-heading">
              <span className="track-artist">{e.artist}</span>
              <Ext href={e.guid} className="track-title">{e.title}</Ext>
            </h3>
            {(e.place || e.date) && <p className="label">{[e.place, e.date].filter(Boolean).join(" · ")}</p>}
            <Downloads entry={e} />
          </li>
        ))}
      </ul>
    </>
  );
}
