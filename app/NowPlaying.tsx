"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Frame } from "./Frame";
import { POLL_SECONDS, REDRAW_SECONDS, STALE_MINUTES } from "@/lib/frame";
import type { Pictures, Status } from "@/lib/store";

type Outcome = { artist?: string; title?: string; refused?: string; reason?: string };

type Props = {
  status: Status | null;
  pictures?: Pictures;
  /** The request on its way to the frame (its id is when it was sent), and what it asks for. */
  pending: number | null;
  requested?: string;
  /** The frame is not checking in right now: the request waits until it does. */
  away?: string;
  /** The request just handled, when the page comes back from one: says how it went. */
  done?: boolean;
  /** A request sent long ago and never picked up. */
  stale?: boolean;
};

const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The frame as it is now, and the progress of a request on its way to it. */
export function NowPlaying({ status, pictures = {}, pending, requested, away, done, stale }: Props) {
  const router = useRouter();
  const banner = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!pending) return;
    setOutcome(null);
    banner.current?.scrollIntoView({ block: "nearest" });
    const tick = setInterval(() => {
      const seconds = Math.max(0, (Date.now() - pending) / 1000);
      setElapsed(seconds);
      if (seconds > STALE_MINUTES * 60) router.refresh(); // never picked up: the server unlocks the page
    }, 1000);
    const poll = setInterval(async () => {
      const res = await fetch("/api/status", { cache: "no-store" }).catch(() => null);
      const s = res?.ok ? ((await res.json()) as Outcome & { handled: number }) : { handled: 0 };
      if (s.handled >= pending) {
        clearInterval(poll);
        setOutcome(s);
        setTimeout(() => router.replace(`/control?done=${pending}`), 1600); // let the flash play, then the new picture
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pending, router]);

  const step = outcome ? 3 : elapsed < POLL_SECONDS ? 1 : 2;
  const steps = [
    "Request sent",
    away ? `Frame picks it up · ${away}` : "Frame picks it up · within a minute",
    `Drawing and e-ink redraw · about ${REDRAW_SECONDS} seconds`,
  ];
  // Said out loud by screen readers: the list's classes change, its text does not
  const progress = outcome
    ? outcome.refused ? `Not hung: ${outcome.refused}.` : `Done: ${outcome.artist} — ${outcome.title} is on the wall.`
    : `Step ${step + 1} of 3: ${steps[step]}.`;

  return (
    <section className="now">
      {pending ? (
        <div ref={banner} className={outcome ? (outcome.refused ? "request refused" : "request ok") : "request"}>
          <p className="label">
            {outcome ? (outcome.refused ? "Not sent to the screen" : "On the screen") : `Sending to the screen · ${clock(elapsed)}`}
          </p>
          <p className="request-what">
            {outcome
              ? outcome.refused
                ? <>{outcome.refused}<span className="request-why">{outcome.reason ? `Because ${outcome.reason}. ` : ""}The frame kept what it shows.</span></>
                : `${outcome.artist} — ${outcome.title}`
              : requested}
          </p>
          <p className="sr-only" role="status">{progress}</p>
          {!outcome && (
            <>
              <ol className="steps">
                {steps.map((label, i) => (
                  <li key={label} className={i < step ? "done" : i === step ? "active" : ""} aria-current={i === step ? "step" : undefined}>
                    {label}
                    {i < step && <span className="sr-only"> (done)</span>}
                  </li>
                ))}
              </ol>
              <p className="request-note">
                The frame is drawing it: new requests wait until it is done. You can still download the pictures.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {stale && (
            <p className="notice" role="status">
              Your last request has not reached the frame after {STALE_MINUTES} minutes (is it asleep or offline?). It
              will be drawn when the frame checks in; sending another one replaces it.
            </p>
          )}
          {status?.refused ? (
            <p className="notice refused" role={done ? "alert" : undefined}>
              <strong>Not hung: {status.refused}.</strong> {status.reason ? `Because ${status.reason}.` : "Liner found no map of where the artist comes from."} The
              frame kept what it shows.
            </p>
          ) : done && status ? (
            <p className="notice ok" role="status">
              <strong>Sent to the screen.</strong> {status.artist} — {status.title} is on the wall.
            </p>
          ) : null}
        </>
      )}

      <Frame
        src={pictures.eink && status ? `${pictures.eink.url}?v=${status.at}` : undefined}
        alt={status ? `Liner showing ${status.artist} — ${status.title}${status.place ? `, over a map of ${status.place}` : ""}` : "The frame"}
        state={pending ? (outcome ? "flash" : "waiting") : undefined}
      />

      {status && (
        <div className="caption">
          <div>
            <span className="tag tag-verified">On the wall</span>
            <h2 className="track-heading">
              <span className="track-artist">{status.artist}</span>
              <span className="track-title">{status.title}</span>
            </h2>
            <p className="label">
              {[status.place, `since ${when.format(new Date(status.at))}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {status && (pictures.eink || pictures.bw || pictures.hd) && (
        <div className="downloads">
          {pictures.hd && <a href={pictures.hd.downloadUrl} download className="btn small">4K wallpaper<span aria-hidden="true"> ↓</span></a>}
          {pictures.eink && <a href={pictures.eink.downloadUrl} download className="btn secondary small">E-ink PNG<span aria-hidden="true"> ↓</span></a>}
          {pictures.bw && <a href={pictures.bw.downloadUrl} download className="btn secondary small">Black &amp; white PNG<span aria-hidden="true"> ↓</span></a>}
        </div>
      )}
    </section>
  );
}
