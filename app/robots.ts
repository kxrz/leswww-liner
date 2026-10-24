import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Crawlers may fetch everything but the API: /control must be fetched for its noindex to be seen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
