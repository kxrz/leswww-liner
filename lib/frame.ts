/** The panel: Pimoroni Inky Impression 7.3" Spectra 6. */
export const PANEL = { width: 800, height: 480 };

/** The part of the panel the frame's mat leaves visible (VISIBLE in pi/liner.py). */
export const VISIBLE = { x0: 52, y0: 35, x1: 748, y1: 480 };

/** How long the frame takes: it polls every minute, then the e-ink redraw lasts about 30 seconds. */
export const POLL_SECONDS = 60;
export const REDRAW_SECONDS = 35;
