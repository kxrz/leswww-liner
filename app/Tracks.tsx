"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { send } from "./actions";

/** A track from the feed, with the pictures already made for it (download addresses). */
export type TrackRow = { guid: string; title: string; artist: string; album: boolean; cover?: string; eink?: string; hd?: string };

type Props = { tracks: TrackRow[]; current?: string; locked: boolean };

const PAGE = 10;

/** Lower case, without accents: "Agnès" matches "agnes". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function SendButton({ disabled, title }: { disabled: boolean; title: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn secondary small" disabled={disabled || pending}>
      {pending ? "Sending…" : <>Send to screen <span aria-hidden="true">→</span></>}
      <span className="sr-only">: {title}</span>
    </button>
  );
}

/** The feed's tracks: search, ten at a time, and a button to send one to the frame. */
export function Tracks({ tracks, current, locked }: Props) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [sending, setSending] = useState<string | null>(null);

  // Once the page knows about the request (or it is done), the lock comes from the server
  useEffect(() => setSending(null), [locked, current]);

  const found = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return tracks.filter((t) => words.every((w) => fold(`${t.artist} ${t.title}`).includes(w)));
  }, [tracks, query]);
  const off = locked || sending !== null;

  return (
    <>
      <div className="search">
        <label htmlFor="search" className="label">Search a track or an artist</label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Balthazar, Linger On…"
          autoComplete="off"
          aria-describedby="search-count"
        />
        <p id="search-count" className="label" aria-live="polite">
          {query.trim()
            ? `${found.length} of ${tracks.length} tracks match`
            : `${tracks.length} tracks in the feed, newest first`}
        </p>
      </div>

      {locked && (
        <p className="label locked">A request is on its way: new ones wait until the frame is done. Downloads still work.</p>
      )}

      {found.length === 0 ? (
        <p className="empty-list">No track matches “{query.trim()}” in this feed.</p>
      ) : (
        <ul className="tracks">
          {found.slice(0, shown).map((t) => {
            const isCurrent = t.guid === current;
            return (
              <li key={t.guid} className={isCurrent ? "current" : undefined} aria-current={isCurrent ? "true" : undefined}>
                {t.cover ? <img src={t.cover} alt="" width={52} height={52} className="cover" loading="lazy" /> : <span className="cover" />}
                <div className="track-info">
                  {isCurrent && <span className="tag tag-verified now-tag">On the wall</span>}
                  <span className="track-title">{t.title}</span>
                  <span className="track-artist">{t.artist}{t.album && <em> · album</em>}</span>
                </div>
                <div className="track-actions">
                  {!isCurrent && (
                    <form action={send} onSubmit={() => setSending(t.guid)}>
                      <input type="hidden" name="action" value="show" />
                      <input type="hidden" name="guid" value={t.guid} />
                      <SendButton disabled={off} title={`${t.artist} — ${t.title}`} />
                    </form>
                  )}
                  {t.eink && <a href={t.eink} download className="tag download">PNG<span className="sr-only">: download the e-ink picture of {t.title}</span></a>}
                  {t.hd && <a href={t.hd} download className="tag download">4K<span className="sr-only">: download the 4K wallpaper of {t.title}</span></a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {found.length > shown && (
        <div className="more">
          <button type="button" className="btn secondary small" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(PAGE, found.length - shown)} more
          </button>
          <span className="label">{shown} of {found.length}</span>
        </div>
      )}
    </>
  );
}
