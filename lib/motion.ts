/**
 * Runs before a public page paints, from an inline script: with motion allowed, the hero title and the lines below it
 * wait for app/Motion.tsx to split them (2.5 s at most), so they do not show, vanish and rise again.
 */
export const MOTION_GATE = `if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("motion");
  setTimeout(() => document.documentElement.classList.add("motion-ready"), 2500);
}`;
