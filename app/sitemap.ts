import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/gallery`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE.url}/llms.txt`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
