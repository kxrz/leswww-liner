/** The feeds Liner can follow on 320kbps.club: the whole site, the track of the day, a curator, a playlist, a genre. */
export type Source = {
  url: string;
  label: string;
  kind: "site" | "daily" | "curator" | "playlist" | "genre";
  /** One line about it: a playlist's description, a curator's bio. */
  note?: string;
  /** "12 tracks", as the site counts them. */
  count?: string;
  /** For a curator's playlist: whose it is. */
  by?: string;
};

export type Curator = { name: string; bio?: string; stats?: string; feed: Source; playlists: Source[] };

/** Everything to choose from, the way 320kbps.club lays it out. */
export type Catalog = { site: Source[]; curators: Curator[]; playlists: Source[]; genres: Source[] };

const BASE = "https://www.320kbps.club";
const DAY = 60 * 60 * 24;

export const SITE_FEED: Source = { url: `${BASE}/feed.xml`, label: "Everything on 320kbps.club", kind: "site" };
export const DAILY_FEED: Source = {
  url: `${BASE}/today/feed.xml`,
  label: "Track of the day",
  kind: "daily",
  note: "One hand-picked track every day",
};

async function page(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: DAY } }).catch(() => null);
  return res?.ok ? res.text() : "";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#x27": "'" };
const text = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/**
 * The cards of a 320kbps.club index page (/playlists, /curators, /curator/x/playlists): each one a link holding
 * a name, maybe a line about it, and its counts — or, for a genre, just its name.
 */
function cards(html: string, prefix: string): { slug: string; lines: string[] }[] {
  const seen = new Set<string>();
  const found: { slug: string; lines: string[] }[] = [];
  for (const [, slug, inner] of html.matchAll(new RegExp(`<a[^>]*href="${prefix}([^"/?#]+)"[^>]*>([\\s\\S]*?)</a>`, "g"))) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const lines = [...inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).filter(Boolean);
    found.push({ slug, lines: lines.length ? lines : [text(inner)] });
  }
  return found;
}

const isCount = (line: string) => /^\d+ (tracks?|playlists?|albums?)\b/.test(line);

function playlist(card: { slug: string; lines: string[] }, by?: string): Source {
  const [label, ...rest] = card.lines;
  return {
    url: `${BASE}/playlist/${card.slug}/feed.xml`,
    label,
    kind: "playlist",
    note: rest.find((l) => !isCount(l)),
    count: rest.find(isCount),
    by,
  };
}

/** Read from the site's own index pages, once a day: names, descriptions and counts, which the sitemap lacks. */
export async function getCatalog(): Promise<Catalog> {
  const [playlistsPage, curatorsPage] = await Promise.all([page("/playlists"), page("/curators")]);

  // On /playlists, playlists are cards with a count; genres are bare links
  const all = cards(playlistsPage, "/playlist/");
  const playlists = all.filter((c) => c.lines.length > 1).map((c) => playlist(c));
  const genres = all
    .filter((c) => c.lines.length === 1)
    .map((c) => ({ url: `${BASE}/playlist/${c.slug}/feed.xml`, label: c.lines[0], kind: "genre" as const }));

  const curators = await Promise.all(
    cards(curatorsPage, "/curator/").map(async (c) => {
      const [name, ...rest] = c.lines;
      const own = cards(await page(`/curator/${c.slug}/playlists`), "/playlist/").map((p) => playlist(p, name));
      return {
        name,
        bio: rest.find((l) => !/^\d+ tracks?\b/.test(l)),
        stats: rest.find((l) => /^\d+ tracks?\b/.test(l)),
        feed: { url: `${BASE}/curator/${c.slug}/feed.xml`, label: `Everything ${name} picked`, kind: "curator" as const, by: name },
        playlists: own,
      };
    }),
  );

  return { site: [SITE_FEED, DAILY_FEED], curators, playlists, genres };
}

/** Every source in one list, to name a feed the frame follows. */
export function flatten(catalog: Catalog): Source[] {
  return [
    ...catalog.site,
    ...catalog.curators.flatMap((c) => [c.feed, ...c.playlists]),
    ...catalog.playlists,
    ...catalog.genres,
  ];
}
