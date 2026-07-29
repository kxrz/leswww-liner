import GalleryClient from "@/components/GalleryClient";
import { listCrops, listDisplay, listOriginals } from "@/lib/blob";
import { basenameWithoutExt } from "@/lib/selection";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

async function deleteImageAction(formData: FormData): Promise<void> {
  "use server";

  const originalUrl = formData.get("originalUrl");
  const fileBase = formData.get("fileBase");
  if (typeof originalUrl !== "string" || typeof fileBase !== "string") {
    return;
  }

  // Les chemins dérivés sont déterministes (store-display écrit toujours
  // crops/<base>.jpg et display/<base>.png) et del() ignore les blobs absents.
  await del([originalUrl, `crops/${fileBase}.jpg`, `display/${fileBase}.png`]);
  revalidatePath("/");
}

export default async function Gallery() {
  const [{ blobs: originals }, { blobs: crops }, { blobs: display }] =
    await Promise.all([listOriginals(), listCrops(), listDisplay()]);

  const cropByBase = new Map(
    crops.map((blob) => [basenameWithoutExt(blob.pathname), blob.url]),
  );
  const displayByBase = new Map(
    display.map((blob) => [basenameWithoutExt(blob.pathname), blob.url]),
  );

  return (
    <GalleryClient
      blobs={originals.map((blob) => {
        const base = basenameWithoutExt(blob.pathname);
        return {
          url: blob.url,
          pathname: blob.pathname,
          originalUrl: blob.url,
          cropUrl: cropByBase.get(base) ?? null,
          displayUrl: displayByBase.get(base) ?? null,
          fileBase: base,
        };
      })}
      deleteAction={deleteImageAction}
    />
  );
}
