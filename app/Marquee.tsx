"use client";

import { useState } from "react";
import { Frame } from "./Frame";

/** Recently on the wall: a slow strip of pictures, with a pause button (RGAA 13.8). Decorative for screen readers. */
export function Marquee({ pictures }: { pictures: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <section className="strip">
      <div className={paused ? "marquee paused" : "marquee"} aria-hidden="true">
        {[...pictures, ...pictures].map((src, i) => (
          <Frame key={i} src={src} alt="" small />
        ))}
      </div>
      <button type="button" className="tag strip-toggle" aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? "Play" : "Pause"}<span className="sr-only"> the strip of recent pictures</span>
      </button>
    </section>
  );
}
