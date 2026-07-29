import GalleryClient from "@/components/GalleryClient";
import { listCrops, listOriginals } from "@/lib/blob";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

function basename(pathname: string): string {
  const segments = pathname.split("/");
  return segments[segments.length - 1] ?? pathname;
}

function basenameWithoutExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

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
  const [{ blobs: originals }, { blobs: crops }] = await Promise.all([
    listOriginals(),
    listCrops(),
  ]);

  if (originals.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Aucune image pour le moment.
      </p>
    );
  }

  const cropByBase = new Map<string, string>();
  for (const crop of crops) {
    cropByBase.set(basenameWithoutExt(basename(crop.pathname)), crop.url);
  }

  return (
    <GalleryClient
      blobs={originals.map((blob) => {
        const base = basenameWithoutExt(basename(blob.pathname));
        return {
          url: blob.url,
          pathname: blob.pathname,
          originalUrl: blob.url,
          cropUrl: cropByBase.get(base) ?? null,
          fileBase: base,
        };
      })}
      deleteAction={deleteImageAction}
    />
  );
}
