/** Who and where: shared by metadata, structured data, robots, sitemap and llms.txt. */
export const SITE = {
  url: "https://liner.leswww.com",
  title: "Liner · an e-ink frame for one track at a time · a LesWWW project",
  description:
    "Liner is an open-source e-ink frame that hangs one track from 320kbps.club at a time, twice a day: the cover and its liner notes on a museum label, laid over a map of where the artist comes from. Raspberry Pi Zero 2 W, Pimoroni Inky Impression Spectra 6. A LesWWW project by Florent Bertiaux.",
  repo: "https://github.com/kxrz/leswww-liner",
  studio: "https://www.leswww.com",
  music: "https://www.320kbps.club",
  linkedin: "https://www.linkedin.com/in/florentbertiaux",
} as const;

/** Legal pages live on the main LesWWW site. */
export const LEGAL = [
  { label: "Legal notice", href: `${SITE.studio}/mentions-legales` },
  { label: "Privacy", href: `${SITE.studio}/politique-de-confidentialite` },
  { label: "Terms", href: `${SITE.studio}/cgv` },
  { label: "LLM info", href: `${SITE.studio}/llm-info` },
] as const;
