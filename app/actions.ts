"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, fingerprint, isLoggedIn, same } from "@/lib/auth";
import { fetchFeed } from "@/lib/fetch-feed";
import { listSources, SITE_FEED } from "@/lib/sources";
import { writeCommand, writeSettings, type Command } from "@/lib/store";

export async function login(form: FormData) {
  const password = process.env.SITE_PASSWORD;
  const given = String(form.get("password") ?? "");
  if (password && same(fingerprint(given), fingerprint(password))) {
    (await cookies()).set(COOKIE, fingerprint(password), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/control");
  }
  await new Promise((r) => setTimeout(r, 1000)); // slows down guessing
  redirect("/control?wrong=1");
}

export async function send(form: FormData) {
  if (!(await isLoggedIn())) redirect("/control");
  const action = form.get("action");
  if (action !== "next" && action !== "refresh" && action !== "show") redirect("/control");
  const command: Command = { id: Date.now(), action };
  const guid = form.get("guid");
  if (action === "show" && typeof guid === "string") command.guid = guid;
  await writeCommand(command);
  redirect(`/control?sent=${command.id}`);
}

/** Follow any RSS feed with items in it; "reset" goes back to the whole of 320kbps.club. */
export async function setSource(form: FormData) {
  if (!(await isLoggedIn())) redirect("/control");
  if (form.get("reset")) {
    await writeSettings({ feed: SITE_FEED.url, feedLabel: SITE_FEED.label });
    redirect("/control?source=reset");
  }
  const feed = String(form.get("feed") ?? "").trim();
  const xml = await fetchFeed(feed);
  if (!/<item[\s>]/.test(xml)) redirect("/control?source=invalid");
  const known = (await listSources()).flatMap((g) => g.sources).find((x) => x.url === feed)?.label;
  const title = xml.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/)?.[1]?.trim().slice(0, 120);
  await writeSettings({ feed, feedLabel: known ?? title ?? feed });
  redirect("/control?source=saved");
}
