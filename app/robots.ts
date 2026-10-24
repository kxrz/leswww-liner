import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Search engines and AI crawlers are welcome on the landing page; the control room and the API are private.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/control", "/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
