export type Item = { guid: string; link: string; title: string; artist: string; album: boolean; cover?: string };

const FEED = "https://www.320kbps.club/feed.xml";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" ? 2 : 1), e[1] === "x" ? 16 : 10)) : ENTITIES[e] ?? m,
  );
}

function tag(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1].trim() ?? "");
}

/** Les morceaux et albums du flux, du plus récent au plus ancien (les playlists sont écartées). */
export async function getItems(): Promise<Item[]> {
  const xml = await fetch(FEED, { next: { revalidate: 600 } }).then((r) => r.text());
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, block]) => {
      const raw = tag(block, "title");
      const album = raw.startsWith("New album: ");
      const [artist, ...rest] = raw.replace("New album: ", "").split(" — ");
      return {
        guid: tag(block, "guid"),
        link: tag(block, "link"),
        title: (rest.join(" — ") || artist).replace(/ - (EP|Single)$/, ""),
        artist,
        album,
        cover: block.match(/<media:content url="([^"]+)"/)?.[1],
      };
    })
    .filter((i) => !i.link.includes("/playlist/"));
}
