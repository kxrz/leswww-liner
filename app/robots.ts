import type { MetadataRoute } from "next";

/**
 * Ce site pilote un objet posé dans un salon : il n'a aucune raison
 * d'apparaître dans un moteur de recherche. Première des trois barrières, avec
 * l'en-tête `X-Robots-Tag` (next.config.ts) et la balise `robots` du layout.
 *
 * Un `robots.txt` n'est qu'une consigne, respectée par les robots honnêtes et
 * ignorée par les autres : la vraie protection reste `SITE_PASSWORD`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
