import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { readGallery, readStatus } from "@/lib/store";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [status, gallery] = await Promise.all([readStatus(), readGallery()]);
  return [
    { url: SITE.url, lastModified: status?.at, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/gallery`, lastModified: gallery[0]?.at, changeFrequency: "daily", priority: 0.8 },
  ];
}
