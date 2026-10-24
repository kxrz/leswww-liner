"use client";

import { useEffect, useState } from "react";
import { Frame } from "../Frame";

export type Entry = {
  slug: string; guid: string; title: string; artist: string; place?: string; date?: string;
  eink: string; hd?: string; downloads: { label: string; url: string; primary?: boolean }[];
};

/** The gallery: one picture large in the frame, every other one below. Click to hang it; the URL hash keeps it. */
export function Viewer({ entries }: { entries: Entry[] }) {
  const [current, setCurrent] = useState(entries[0]?.slug);

  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      if (entries.some((e) => e.slug === slug)) setCurrent(slug);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [entries]);

  const shown = entries.find((e) => e.slug === current) ?? entries[0];
  if (!shown) return <p className="label">Nothing has hung on the wall yet.</p>;

  return (
    <>
      <section className="showcase" id="frame">
        <Frame src={shown.eink} alt={`${shown.artist} — ${shown.title}, on Liner`} />
        <div className="caption">
          <div>
            <p className="track-artist">{shown.artist}</p>
            <a href={shown.guid} className="track-title">{shown.title}</a>
            <p className="label">{[shown.place, shown.date].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="downloads">
          {shown.downloads.map((d) => (
            <a key={d.label} href={d.url} className={d.primary ? "btn small" : "btn secondary small"}>{d.label}</a>
          ))}
          <a href={shown.guid} className="btn secondary small">Listen on 320kbps.club →</a>
        </div>
      </section>

      <ul className="gallery">
        {entries.map((e) => (
          <li key={e.slug} className={e.slug === shown.slug ? "card current" : "card"}>
            <a
              href={`#${e.slug}`}
              className="thumb"
              onClick={() => document.getElementById("frame")?.scrollIntoView({ behavior: "smooth" })}
              aria-label={`Hang ${e.artist} — ${e.title} in the frame`}
            >
              <img src={e.eink} alt="" loading="lazy" width={800} height={480} />
            </a>
            <div>
              <p className="track-artist">{e.artist}</p>
              <a href={e.guid} className="track-title">{e.title}</a>
              <p className="label">{[e.place, e.date].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="downloads">
              {e.downloads.map((d) => (
                <a key={d.label} href={d.url} className={d.primary ? "btn small" : "btn secondary small"}>{d.label}</a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
