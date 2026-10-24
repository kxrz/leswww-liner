/** The feeds Liner can follow on 320kbps.club: the whole site, a curator, or a playlist. */
export type Source = { url: string; label: string };
export type SourceGroup = { label: string; sources: Source[] };

export const SITE_FEED: Source = { url: "https://www.320kbps.club/feed.xml", label: "Everything on 320kbps.club" };

const BASE = "https://www.320kbps.club";
const DAY = 60 * 60 * 24;

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

async function page(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: DAY } });
  return res.ok ? res.text() : "";
}

/** A curator's display name, from their page title ("EuraCreative — 320kbps.club"). */
function nameOf(html: string, slug: string): string {
  return html.match(/<title>([^<—]+)\s*—/)?.[1].trim() || titleCase(slug);
}

/** Every source, grouped for a menu: the site, then each curator with their playlists, then genre playlists. */
export async function listSources(): Promise<SourceGroup[]> {
  const sitemap = await page("/sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>https:\/\/www\.320kbps\.club\/([^<]+)<\/loc>/g)].map((m) => m[1]);
  const curators = locs.filter((l) => /^curator\/[^/]+$/.test(l)).map((l) => l.split("/")[1]);
  const playlists = locs.filter((l) => /^playlist\/[^/]+$/.test(l)).map((l) => l.split("/")[1]);

  const claimed = new Set<string>();
  const groups: SourceGroup[] = [{ label: "320kbps.club", sources: [SITE_FEED] }];
  for (const curator of curators) {
    const [home, lists] = await Promise.all([page(`/curator/${curator}`), page(`/curator/${curator}/playlists`)]);
    const name = nameOf(home, curator);
    const own = [...new Set([...lists.matchAll(/href="\/playlist\/([^"/]+)"/g)].map((m) => m[1]))];
    own.forEach((p) => claimed.add(p));
    groups.push({
      label: `Curator · ${name}`,
      sources: [
        { url: `${BASE}/curator/${curator}/feed.xml`, label: `Everything ${name} picked` },
        ...own.map((p) => ({ url: `${BASE}/playlist/${p}/feed.xml`, label: `${name} · ${titleCase(p)}` })),
      ],
    });
  }
  const others = playlists.filter((p) => !claimed.has(p));
  if (others.length) {
    groups.push({
      label: "Playlists",
      sources: others.map((p) => ({ url: `${BASE}/playlist/${p}/feed.xml`, label: titleCase(p) })),
    });
  }
  return groups;
}
