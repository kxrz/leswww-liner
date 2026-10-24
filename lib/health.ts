import type { Health } from "./store";

/** The frame checks in every 15 minutes from 7:00 to midnight (Paris time), and sleeps the rest of the night. */
const SILENT_MINUTES = 45;

export type FrameState = { state: "online" | "silent" | "asleep" | "unknown"; minutes: number | null };

export function frameState(health: Health | null, now = new Date()): FrameState {
  if (!health) return { state: "unknown", minutes: null };
  const minutes = Math.round((now.getTime() - new Date(health.at).getTime()) / 60000);
  if (minutes <= SILENT_MINUTES) return { state: "online", minutes };
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now));
  return { state: hour < 7 ? "asleep" : "silent", minutes };
}

export function ago(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}
