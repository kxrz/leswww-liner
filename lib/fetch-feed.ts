import { isIP } from "node:net";

const MAX_BYTES = 2_000_000;

/** Hosts a feed may never point at: loopback, private ranges, link-local, and bare IP addresses. */
function forbidden(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return isIP(h) !== 0 || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal");
}

/**
 * Fetch a feed the owner typed in, safely: https only, public host names only (checked again on every redirect),
 * ten seconds and 2 MB at most. Returns the XML, or "" when anything is off.
 */
export async function fetchFeed(url: string, revalidate?: number): Promise<string> {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return "";
    }
    if (parsed.protocol !== "https:" || forbidden(parsed.hostname)) return "";
    const res = await fetch(parsed, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    }).catch(() => null);
    if (!res) return "";
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      target = new URL(res.headers.get("location")!, parsed).toString();
      continue;
    }
    if (!res.ok || Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return "";
    const text = await res.text();
    return text.length > MAX_BYTES ? "" : text;
  }
  return "";
}
