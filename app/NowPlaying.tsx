"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PANEL, POLL_SECONDS, REDRAW_SECONDS, VISIBLE } from "@/lib/frame";
import type { Status, Visual } from "@/lib/store";

type Props = { status: Status | null; visual?: Visual; pending: number | null };

const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" });

// The picture is the full 800×480 panel; the mockup only shows what the mat leaves visible.
const visibleW = VISIBLE.x1 - VISIBLE.x0;
const visibleH = VISIBLE.y1 - VISIBLE.y0;
const crop = {
  width: `${(PANEL.width / visibleW) * 100}%`,
  left: `${(-VISIBLE.x0 / visibleW) * 100}%`,
  top: `${(-VISIBLE.y0 / visibleH) * 100}%`,
};

export function NowPlaying({ status, visual, pending }: Props) {
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
        setTimeout(() => router.replace("/"), 1600); // let the flash play, then show the new picture
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pending, router]);

  const step = done ? 3 : elapsed < POLL_SECONDS ? 1 : 2;
  const steps = [
    "Request sent",
    "Frame picks it up · within a minute",
    `E-ink redraw · about ${REDRAW_SECONDS} seconds`,
  ];

  return (
    <section className="now">
      <div className="frame">
        <div className="mat">
          <div className={`screen${pending ? (done ? " flash" : " waiting") : ""}`} style={{ aspectRatio: `${visibleW} / ${visibleH}` }}>
            {visual && status ? (
              <img src={`${visual.url}?v=${status.at}`} alt={`${status.artist} — ${status.title}`} style={crop} />
            ) : (
              <p className="mono empty">Nothing on the wall yet</p>
            )}
          </div>
        </div>
      </div>

      {pending ? (
        <ol className="steps" aria-live="polite">
          {steps.map((label, i) => (
            <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>{label}</li>
          ))}
        </ol>
      ) : null}

      {status && (
        <div className="caption">
          <div>
            <p className="artist">{status.artist}</p>
            <p className="title">{status.title}</p>
            <p className="mono">
              {[status.place, `on the wall since ${when.format(new Date(status.at))}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          {visual && <a href={visual.downloadUrl} className="download">PNG ↓</a>}
        </div>
      )}
    </section>
  );
}
