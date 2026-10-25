"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { setSource } from "./actions";
import type { Catalog, Source } from "@/lib/sources";

type Props = { catalog: Catalog; current: string; currentLabel: string; locked: boolean };
type Filter = "all" | "curators" | "playlists" | "genres";
type Preview = { count: number; hung: number; newest: { title: string; artist: string; cover?: string }[] };

const GENRES_SHOWN = 24;
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const KIND = { site: "320kbps.club", daily: "Every day", curator: "Curator", playlist: "Playlist", genre: "Genre" };

function FollowButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Following…" : <>Follow this feed <span aria-hidden="true">→</span></>}
    </button>
  );
}

/** Every feed of 320kbps.club, to browse, search, preview and follow without knowing its address. */
export function Sources({ catalog, current, currentLabel, locked }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [allGenres, setAllGenres] = useState(false);
  const [picked, setPicked] = useState<Source | null>(null);
  const [preview, setPreview] = useState<Preview | "loading" | "error">("loading");
  const sheet = useRef<HTMLDialogElement>(null);

  const words = fold(query).split(/\s+/).filter(Boolean);
  const match = (...fields: (string | undefined)[]) => words.every((w) => fold(fields.filter(Boolean).join(" ")).includes(w));
  const shows = (f: Filter) => filter === "all" || filter === f;

  const curators = catalog.curators
    .map((c) => {
      const own = match(c.name, c.bio);
      return { ...c, playlists: own ? c.playlists : c.playlists.filter((p) => match(p.label, p.note)), own };
    })
    .filter((c) => c.own || c.playlists.length);
  const site = catalog.site.filter((s) => match(s.label, s.note));
  const playlists = catalog.playlists.filter((p) => match(p.label, p.note));
  const genres = catalog.genres.filter((g) => match(g.label));
  const nothing = !site.length && !curators.length && !playlists.length && !genres.length;

  useEffect(() => {
    if (!picked) return;
    sheet.current?.showModal();
    setPreview("loading");
    const ask = new AbortController();
    fetch(`/api/source?url=${encodeURIComponent(picked.url)}`, { signal: ask.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: Preview) => setPreview(p))
      .catch(() => !ask.signal.aborted && setPreview("error"));
    return () => ask.abort();
  }, [picked]);

  const row = (s: Source) => (
    <li key={s.url} className={s.url === current ? "source-row current" : "source-row"}>
      <span className="source-name">
        <strong>{s.label}</strong>
        {(s.count || s.note) && <span>{[s.count, s.note].filter(Boolean).join(" · ")}</span>}
      </span>
      {s.url === current ? (
        <span className="tag tag-verified">Followed</span>
      ) : (
        <button type="button" className="btn secondary small" onClick={() => setPicked(s)}>
          Preview<span className="sr-only">: {s.label}</span>
        </button>
      )}
    </li>
  );

  return (
    <div className="sources">
      <div className="source-current">
        <span className="label">The frame follows</span>
        <strong>{currentLabel}</strong>
      </div>

      <div className="search">
        <label htmlFor="find-source" className="label">Find a curator, a playlist or a genre</label>
        <input
          id="find-source"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jazz, late night, a curator…"
          autoComplete="off"
        />
      </div>
      <div className="chips" role="group" aria-label="Show">
        {([
          ["all", "All"],
          ["curators", `Curators · ${catalog.curators.length}`],
          ["playlists", `Playlists · ${catalog.playlists.length}`],
          ["genres", `Genres · ${catalog.genres.length}`],
        ] as [Filter, string][]).map(([f, label]) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>

      {nothing && <p className="empty-list">Nothing on 320kbps.club matches “{query.trim()}”.</p>}

      {filter === "all" && site.length > 0 && (
        <section className="source-group" aria-labelledby="g-site">
          <h3 id="g-site" className="label">320kbps.club</h3>
          <ul>{site.map(row)}</ul>
        </section>
      )}

      {shows("curators") && curators.length > 0 && (
        <section className="source-group" aria-labelledby="g-curators">
          <h3 id="g-curators" className="label">Curators</h3>
          <ul>
            {curators.map((c) => {
              const expanded = open.has(c.name) || (words.length > 0 && !c.own);
              return (
                <li key={c.name} className="curator">
                  <button
                    type="button"
                    className="curator-head"
                    aria-expanded={expanded}
                    onClick={() => setOpen((o) => {
                      const next = new Set(o);
                      if (next.has(c.name)) next.delete(c.name);
                      else next.add(c.name);
                      return next;
                    })}
                  >
                    <span className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
                    <span className="source-name">
                      <strong>{c.name}</strong>
                      <span>{c.stats ?? c.bio}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="chevron">
                      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                  {expanded && <ul className="curator-feeds">{[c.feed, ...c.playlists].map(row)}</ul>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shows("playlists") && playlists.length > 0 && (
        <section className="source-group" aria-labelledby="g-playlists">
          <h3 id="g-playlists" className="label">Playlists</h3>
          <ul>{playlists.map(row)}</ul>
        </section>
      )}

      {shows("genres") && genres.length > 0 && (
        <section className="source-group" aria-labelledby="g-genres">
          <h3 id="g-genres" className="label">Genres</h3>
          <ul className="genres">
            {(allGenres || words.length || filter === "genres" ? genres : genres.slice(0, GENRES_SHOWN)).map((g) => (
              <li key={g.url}>
                <button
                  type="button"
                  className="chip"
                  aria-current={g.url === current ? "true" : undefined}
                  onClick={() => setPicked(g)}
                >
                  {g.label}
                </button>
              </li>
            ))}
          </ul>
          {!allGenres && !words.length && filter !== "genres" && genres.length > GENRES_SHOWN && (
            <button type="button" className="btn secondary small more-genres" onClick={() => setAllGenres(true)}>
              Show all {genres.length} genres
            </button>
          )}
        </section>
      )}

      <dialog ref={sheet} className="sheet" aria-labelledby="sheet-title" onClose={() => setPicked(null)}>
        {picked && (
          <>
            <div className="sheet-head">
              <div>
                <span className="label">{KIND[picked.kind]}{picked.by && picked.kind !== "curator" ? ` · by ${picked.by}` : ""}</span>
                <h3 id="sheet-title">{picked.label}</h3>
              </div>
              <button type="button" className="sheet-close" aria-label="Close" onClick={() => sheet.current?.close()}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
            {picked.note && <p className="sheet-note">{picked.note}</p>}

            {preview === "loading" && <p className="label" role="status">Reading the feed…</p>}
            {preview === "error" && <p className="form-error" role="alert">Error: this feed could not be read right now.</p>}
            {typeof preview === "object" && (
              <>
                <div className="sheet-tags">
                  <span className="tag tag-verified">{preview.count} {preview.count === 1 ? "track" : "tracks"}</span>
                  {preview.hung > 0 && <span className="tag">{preview.hung} already on the wall</span>}
                </div>
                {preview.newest.length > 0 && (
                  <>
                    <h4 className="label sheet-sub">Newest in this feed</h4>
                    <ul className="sheet-tracks">
                      {preview.newest.map((t) => (
                        <li key={`${t.artist}-${t.title}`}>
                          {t.cover ? <img src={t.cover} alt="" width={52} height={52} /> : <span className="cover" />}
                          <span className="source-name"><strong>{t.title}</strong><span>{t.artist}</span></span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            <form action={setSource} className="sheet-follow">
              <input type="hidden" name="feed" value={picked.url} />
              <label className="check">
                <input type="checkbox" name="hang" value="1" defaultChecked={!locked} disabled={locked} />
                {locked ? "A request is on its way: the frame will take this feed for the next one" : "Hang a track from it now"}
              </label>
              <FollowButton />
              <span className="label">Morning and evening tracks will come from it</span>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
}
