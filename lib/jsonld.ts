import { SITE } from "./site";

const STUDIO = "https://www.leswww.com";

/** One graph for the landing page: the page, the object, its code, its maker and the two brands around it. */
export function landingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE.url}/#webpage`,
        url: SITE.url,
        name: SITE.title,
        description: SITE.description,
        inLanguage: "en",
        primaryImageOfPage: `${SITE.url}/og.png`,
        about: { "@id": `${SITE.url}/#liner` },
        author: { "@id": `${STUDIO}/#person` },
        publisher: { "@id": `${STUDIO}/#service` },
      },
      {
        "@type": "CreativeWork",
        "@id": `${SITE.url}/#liner`,
        name: "Liner",
        alternateName: "Liner by LesWWW",
        description: SITE.description,
        url: SITE.url,
        image: `${SITE.url}/og.png`,
        genre: ["E-ink art", "Music discovery", "Data visualisation"],
        keywords: "e-ink, Raspberry Pi, Inky Impression, album art, liner notes, MusicBrainz, maps",
        creator: { "@id": `${STUDIO}/#person` },
        publisher: { "@id": `${STUDIO}/#service` },
        isBasedOn: { "@type": "WebSite", name: "320kbps.club", url: SITE.music },
        workExample: { "@id": `${SITE.url}/#code` },
        license: "https://opensource.org/licenses/MIT",
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${SITE.url}/#code`,
        name: "leswww-liner",
        codeRepository: SITE.repo,
        programmingLanguage: ["Python", "TypeScript"],
        runtimePlatform: ["Raspberry Pi OS", "Vercel"],
        license: "https://opensource.org/licenses/MIT",
        author: { "@id": `${STUDIO}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${STUDIO}/#person`,
        name: "Florent Bertiaux",
        url: STUDIO,
        image: `${SITE.url}/florent.png`,
        jobTitle: "Creative technologist",
        description: "Creative, curator and geek: runs LesWWW and curates 320kbps.club.",
        homeLocation: { "@type": "Place", name: "Lille, France" },
        sameAs: [SITE.linkedin, SITE.music, STUDIO],
      },
      {
        "@type": "ProfessionalService",
        "@id": `${STUDIO}/#service`,
        name: "LesWWW",
        slogan: "Why. What. Which way.",
        url: STUDIO,
        logo: `${STUDIO}/brand/leswww-logo-transparent.png`,
        address: { "@type": "PostalAddress", addressLocality: "Lille", addressCountry: "FR" },
        founder: { "@id": `${STUDIO}/#person` },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.music}/#website`,
        name: "320kbps.club",
        url: SITE.music,
        description: "Hand-curated music discovery, one track at a time.",
        creator: { "@id": `${STUDIO}/#person` },
      },
    ],
  };
}
