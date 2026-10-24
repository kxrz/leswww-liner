/** Who and where: shared by metadata, structured data, robots, sitemap and llms.txt. */
export const SITE = {
  url: "https://liner.leswww.com",
  // "Liner" is also an AI search app: every title says what this Liner is
  title: "Liner: e-ink music frame, one track at a time · LesWWW",
  description:
    "Liner is an open-source e-ink frame by LesWWW: one track from 320kbps.club, twice a day, with its cover, liner notes and a map of where the artist comes from.",
  longDescription:
    "Liner is an open-source e-ink frame that hangs one track from 320kbps.club at a time, twice a day: the cover and its liner notes on a museum label, laid over a map of where the artist comes from. Raspberry Pi Zero 2 W, Pimoroni Inky Impression Spectra 6. A LesWWW project by Florent Bertiaux.",
  disambiguation: "An open-source e-ink picture frame for music by LesWWW; not related to the Liner AI search app.",
  repo: "https://github.com/kxrz/leswww-liner",
  build: "https://github.com/kxrz/leswww-liner/blob/main/docs/BUILD.md",
  studio: "https://www.leswww.com",
  contact: "https://www.leswww.com/en/contact",
  music: "https://www.320kbps.club",
} as const;

/** Legal pages live on the main LesWWW site. */
export const LEGAL = [
  { label: "Legal notice", href: `${SITE.studio}/mentions-legales` },
  { label: "Privacy", href: `${SITE.studio}/politique-de-confidentialite` },
  { label: "Terms", href: `${SITE.studio}/cgv` },
  { label: "LLM info", href: `${SITE.studio}/llm-info` },
] as const;
