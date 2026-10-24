import { ago, frameState } from "@/lib/health";
import { readHealth } from "@/lib/store";

/**
 * Daily check (vercel.json): if the frame has been silent for more than two hours in the daytime, send an email.
 * Needs RESEND_API_KEY and ALERT_EMAIL (and ALERT_FROM, an address on a domain verified in Resend); without them it
 * only reports.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const health = await readHealth();
  const { state, minutes } = frameState(health);
  const silent = state === "unknown" || (state === "silent" && (minutes ?? 0) > 120);
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (silent && key && to) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_FROM ?? "Liner <liner@leswww.com>",
        to,
        subject: "Liner is silent",
        text: `The frame last checked in ${minutes === null ? "never" : ago(minutes)}. Is the Pi powered and on Wi-Fi?\n\nhttps://liner.leswww.com/control`,
      }),
    });
    return Response.json({ state, minutes, alerted: res.ok });
  }
  return Response.json({ state, minutes, alerted: false });
}
