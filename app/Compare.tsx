"use client";

import { useState } from "react";

// The wallpaper is 3840×2160 with the 800×480 layout scaled ×4.5 in the middle (120 px of background each side):
// crop it to that middle so it lines up pixel for pixel with the e-ink picture.
const HD_CROP = { width: `${(3840 / 3600) * 100}%`, left: `${(-120 / 3600) * 100}%` };

/** Before and after: the HD drawing, and what the e-ink panel gets once it has been prepared. Drag to compare. */
export function Compare({ hd, eink, alt }: { hd: string; eink: string; alt: string }) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="compare">
      <div className="compare-stage">
        <img src={hd} alt={`${alt}, HD`} className="compare-hd" style={HD_CROP} />
        <img src={eink} alt={`${alt}, prepared for e-ink`} className="compare-eink" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
        <div className="compare-handle" style={{ left: `${split}%` }} aria-hidden />
        <span className="tag compare-label left">HD</span>
        <span className="tag tag-live compare-label right">E-ink</span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label="Compare the HD picture with the e-ink version"
        />
      </div>
    </figure>
  );
}
