export type Item = { guid: string; link: string; title: string; artist: string; album: boolean; cover?: string };

import { fetchFeed } from "./fetch-feed";
import { SITE_FEED } from "./sources";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" ? 2 : 1), e[1] === "x" ? 16 : 10)) : ENTITIES[e] ?? m,
  );
}

function tag(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1].trim() ?? "");
}

/** Tracks and albums from a feed, newest first (playlists are left out). */
export async function getItems(feed: string = SITE_FEED.url): Promise<Item[]> {
  const xml = await fetchFeed(feed, 600);
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
