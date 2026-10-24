"use client";

import { useState } from "react";

// The wallpaper is 3840×2160 with the 800×480 layout scaled ×4.5 in the middle (120 px of background each side):
// crop it to that middle so it lines up pixel for pixel with the e-ink picture.
const HD_CROP = { width: `${(3840 / 3600) * 100}%`, left: `${(-120 / 3600) * 100}%` };

/** A light version of a Blob picture through Next's optimiser: the 4K wallpaper itself weighs a megabyte. */
const light = (src: string) => (src.startsWith("https://") ? `/_next/image?url=${encodeURIComponent(src)}&w=1920&q=75` : src);

/** Before and after: the HD drawing, and what the e-ink panel gets once it has been prepared. Drag to compare. */
export function Compare({ hd, eink, alt }: { hd: string; eink: string; alt: string }) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="compare">
      <div className="compare-stage">
        <img src={light(hd)} alt={`${alt}, in full definition`} className="compare-hd" style={HD_CROP} loading="lazy" decoding="async" />
        <img
          src={eink}
          alt={`${alt}, prepared for the e-ink panel`}
          className="compare-eink"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          loading="lazy"
          decoding="async"
        />
        <div className="compare-handle" style={{ left: `${split}%` }} aria-hidden="true" />
        <span className="tag compare-label left" aria-hidden="true">HD</span>
        <span className="tag compare-label right" aria-hidden="true">E-ink</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label="Compare the full-definition picture with the e-ink version"
          aria-valuetext={`${split}% full definition, ${100 - split}% e-ink`}
        />
      </div>
      <figcaption className="label">Drag, or use the arrow keys, to compare.</figcaption>
    </figure>
  );
}
