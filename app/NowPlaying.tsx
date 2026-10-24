"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Frame } from "./Frame";
import { POLL_SECONDS, REDRAW_SECONDS } from "@/lib/frame";
import type { Pictures, Status } from "@/lib/store";

type Props = { status: Status | null; pictures?: Pictures; pending: number | null };

const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" });

/** The frame as it is now, and the progress of a request on its way to it. */
export function NowPlaying({ status, pictures = {}, pending }: Props) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const tick = setInterval(() => setElapsed(Math.max(0, (Date.now() - pending) / 1000)), 1000);
    const poll = setInterval(async () => {
      const res = await fetch("/api/status", { cache: "no-store" }).catch(() => null);
      const { handled } = res?.ok ? ((await res.json()) as { handled: number }) : { handled: 0 };
      if (handled >= pending) {
        clearInterval(poll);
        setDone(true);
        setTimeout(() => router.replace("/control"), 1600); // let the flash play, then show the new picture
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pending, router]);

  const step = done ? 3 : elapsed < POLL_SECONDS ? 1 : 2;
  const steps = ["Request sent", "Frame picks it up · within a minute", `E-ink redraw · about ${REDRAW_SECONDS} seconds`];
  // Said out loud by screen readers: the list's classes change, its text does not
  const progress = done ? "Done: the new picture is on the wall." : `Step ${step + 1} of 3: ${steps[step]}.`;

  return (
    <section className="now">
      <Frame
        src={pictures.eink && status ? `${pictures.eink.url}?v=${status.at}` : undefined}
        alt={status ? `Liner showing ${status.artist} — ${status.title}${status.place ? `, over a map of ${status.place}` : ""}` : "The frame"}
        state={pending ? (done ? "flash" : "waiting") : undefined}
      />

      <p className="sr-only" role="status">{pending ? progress : ""}</p>
      {pending ? (
        <ol className="steps">
          {steps.map((label, i) => (
            <li key={label} className={i < step ? "done" : i === step ? "active" : ""} aria-current={i === step ? "step" : undefined}>
              {label}
              {i < step && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
      ) : null}

      {status?.refused && !pending && (
        <p className="label refused">
          Not hung: {status.refused}. Liner found no map of where the artist comes from, so the frame kept this one.
        </p>
      )}

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
