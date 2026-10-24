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

  return (
    <section className="now">
      <Frame
        src={pictures.eink && status ? `${pictures.eink.url}?v=${status.at}` : undefined}
        alt={status ? `${status.artist} — ${status.title}` : "The frame"}
        state={pending ? (done ? "flash" : "waiting") : undefined}
      />

      {pending ? (
        <ol className="steps" aria-live="polite">
          {steps.map((label, i) => (
            <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>{label}</li>
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
            <span className="tag tag-live">On the wall</span>
            <p className="track-artist">{status.artist}</p>
            <p className="track-title">{status.title}</p>
            <p className="label">
              {[status.place, `since ${when.format(new Date(status.at))}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {status && (pictures.eink || pictures.bw || pictures.hd) && (
        <div className="downloads">
          {pictures.eink && <a href={pictures.eink.downloadUrl} className="btn secondary small">E-ink PNG ↓</a>}
          {pictures.bw && <a href={pictures.bw.downloadUrl} className="btn secondary small">Black &amp; white ↓</a>}
          {pictures.hd && <a href={pictures.hd.downloadUrl} className="btn small">4K wallpaper ↓</a>}
        </div>
      )}
    </section>
  );
}
