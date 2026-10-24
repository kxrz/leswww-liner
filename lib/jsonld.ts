import { SITE } from "./site";

const STUDIO = SITE.studio;
// leswww.com publishes the full Person and ProfessionalService nodes under these ids: refer to them, never redefine
const PERSON = { "@type": "Person", "@id": `${STUDIO}/#person`, name: "Florent Bertiaux", url: STUDIO };
const STUDIO_NODE = { "@type": "ProfessionalService", "@id": `${STUDIO}/#service`, name: "LesWWW", url: STUDIO };
const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: SITE.url,
  name: "Liner",
  inLanguage: "en-GB",
  publisher: { "@id": `${STUDIO}/#service` },
};

/** The landing page: the page, the object, its source code, and references to its maker and studio. */
export function landingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      WEBSITE,
      {
        "@type": "WebPage",
        "@id": `${SITE.url}/#webpage`,
        url: SITE.url,
        name: SITE.title,
        description: SITE.description,
        inLanguage: "en-GB",
        isPartOf: { "@id": `${SITE.url}/#website` },
        primaryImageOfPage: { "@type": "ImageObject", url: `${SITE.url}/og.png`, width: 1200, height: 630 },
        about: { "@id": `${SITE.url}/#liner` },
        author: { "@id": `${STUDIO}/#person` },
        publisher: { "@id": `${STUDIO}/#service` },
      },
      {
        "@type": "CreativeWork",
        "@id": `${SITE.url}/#liner`,
        name: "Liner",
        alternateName: ["Liner by LesWWW", "Liner e-ink frame"],
        disambiguatingDescription: SITE.disambiguation,
        description: SITE.longDescription,
        url: SITE.url,
        image: `${SITE.url}/og.png`,
        genre: ["E-ink art", "Music discovery", "Data visualisation"],
        keywords: "e-ink, Raspberry Pi, Inky Impression, album art, liner notes, MusicBrainz, maps, 4K wallpaper",
        creator: { "@id": `${STUDIO}/#person` },
        publisher: { "@id": `${STUDIO}/#service` },
        isBasedOn: { "@type": "WebSite", name: "320kbps.club", url: SITE.music },
        hasPart: { "@id": `${SITE.url}/#code` },
        license: "https://opensource.org/licenses/MIT",
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${SITE.url}/#code`,
        name: "leswww-liner",
        url: SITE.repo,
        codeRepository: SITE.repo,
        description: "Source code of Liner: the Raspberry Pi renderer (Python, Pillow) and the web page (Next.js on Vercel).",
        programmingLanguage: ["Python", "TypeScript"],
        runtimePlatform: ["Raspberry Pi OS", "Vercel"],
        license: "https://opensource.org/licenses/MIT",
        isPartOf: { "@id": `${SITE.url}/#liner` },
        author: { "@id": `${STUDIO}/#person` },
      },
      PERSON,
      STUDIO_NODE,
    ],
  };
}

export type GalleryImage = { name: string; contentUrl: string; thumbnailUrl: string; isBasedOn: string };

/** The gallery: a page of wallpapers, each an image of a track, with a breadcrumb back to Liner. */
export function galleryJsonLd(images: GalleryImage[]) {
  const url = `${SITE.url}/gallery`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      WEBSITE,
      {
        "@type": "ImageGallery",
        "@id": `${url}#webpage`,
        url,
        name: "Free 4K music wallpapers from Liner",
        inLanguage: "en-GB",
        isPartOf: { "@id": `${SITE.url}/#website` },
        about: { "@id": `${SITE.url}/#liner` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        associatedMedia: images.map((i) => ({
          "@type": "ImageObject",
          name: `${i.name}, 4K wallpaper`,
          contentUrl: i.contentUrl,
          thumbnailUrl: i.thumbnailUrl,
          width: 3840,
          height: 2160,
          encodingFormat: "image/jpeg",
          creator: { "@id": `${STUDIO}/#person` },
          creditText: "Liner by LesWWW",
          copyrightNotice: "Layout and map by LesWWW; cover art © its rights holders",
          isBasedOn: i.isBasedOn,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Liner", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Gallery", item: url },
        ],
      },
    ],
  };
}
