/** The panel: Pimoroni Inky Impression 7.3" Spectra 6. */
export const PANEL = { width: 800, height: 480 };

/**
 * The part of the panel the frame's mat leaves visible, measured with pi/calibrate.py. Same value as LINER_VISIBLE
 * on the Pi; set NEXT_PUBLIC_LINER_VISIBLE ("x0,y0,x1,y1") on Vercel for your own frame.
 */
const [x0, y0, x1, y1] = (process.env.NEXT_PUBLIC_LINER_VISIBLE ?? "52,35,748,480").split(",").map(Number);
export const VISIBLE = { x0, y0, x1, y1 };

/** How long the frame takes: it polls every minute, then the e-ink redraw lasts about 30 seconds. */
export const POLL_SECONDS = 60;
export const REDRAW_SECONDS = 35;
