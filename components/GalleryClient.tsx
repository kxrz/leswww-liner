"use client";

import ImageEditor from "@/components/ImageEditor";
import { TrashIcon } from "@/components/Icons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BlobItem = {
  url: string;
  pathname: string;
  originalUrl: string;
  cropUrl: string | null;
  fileBase: string;
};

type Props = {
  blobs: BlobItem[];
  deleteAction: (formData: FormData) => Promise<void>;
};

export default function GalleryClient({ blobs, deleteAction }: Props) {
  const router = useRouter();
  const [selectedBlob, setSelectedBlob] = useState<BlobItem | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenEditor(blob: BlobItem) {
    setSelectedBlob(blob);
    setEditFile(null);
    setPreview(null);
    setError(null);

    const response = await fetch(blob.originalUrl);
    if (!response.ok) {
      setError("Impossible de charger l'image.");
      return;
    }

    const imageBlob = await response.blob();
    setEditFile(new File([imageBlob], blob.pathname, { type: imageBlob.type }));
  }

  async function handleConfirm(croppedBlob: Blob) {
    if (!selectedBlob) {
      return;
    }

    setReplacing(true);
    setError(null);

    const formData = new FormData();
    formData.append(
      "file",
      new File([croppedBlob], `${selectedBlob.fileBase}.jpg`, {
        type: "image/jpeg",
      }),
    );

    try {
      const response = await fetch("/api/store-display", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Échec de l'enregistrement.");
      }

      // Aperçu du rendu réel : le PNG dithéré utilise les couleurs que la
      // dalle affiche vraiment, ce que le cadrage ne laisse pas deviner.
      const data = (await response.json()) as { displayUrl: string };
      setPreview(`${data.displayUrl}?t=${Date.now()}`);
      setEditFile(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Échec de l'enregistrement.",
      );
    } finally {
      setReplacing(false);
    }
  }

  function handleClose() {
    setSelectedBlob(null);
    setEditFile(null);
    setPreview(null);
    setError(null);
  }

  if (blobs.length === 0) {
    return (
      <p className="text-sm text-fg-muted">Aucune image pour le moment.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {blobs.map((blob) => (
          <div key={blob.url} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleOpenEditor(blob)}
              className="group relative aspect-[5/3] cursor-pointer overflow-hidden rounded-lg border border-line bg-bg-muted transition-colors duration-150 hover:border-line-strong"
            >
              <Image
                src={blob.cropUrl ?? blob.url}
                alt={blob.pathname}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 240px"
              />
              {!blob.cropUrl ? (
                <span className="absolute inset-x-0 bottom-0 bg-fg/80 py-1 text-xs font-medium text-white">
                  À cadrer
                </span>
              ) : null}
            </button>
            <form action={deleteAction}>
              <input
                type="hidden"
                name="originalUrl"
                value={blob.originalUrl}
              />
              <input type="hidden" name="fileBase" value={blob.fileBase} />
              <button type="submit" className="btn btn-danger w-full">
                <TrashIcon />
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>

      {selectedBlob !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-bg p-5 shadow-lg">
            {replacing ? (
              <p className="py-8 text-center text-sm text-fg-muted">
                Calcul du rendu e-ink…
              </p>
            ) : preview ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="sect-title">Rendu sur la dalle</p>
                  <p className="sect-sub">
                    Aperçu fidèle : ce sont les couleurs que l&apos;écran
                    affichera réellement.
                  </p>
                </div>
                <div className="relative aspect-[5/3] w-full overflow-hidden rounded-lg border border-line bg-bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Aperçu du rendu e-ink"
                    className="h-full w-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-primary"
                >
                  Terminé
                </button>
              </div>
            ) : editFile ? (
              <ImageEditor
                file={editFile}
                onConfirm={handleConfirm}
                onCancel={handleClose}
              />
            ) : (
              <p className="py-8 text-center text-sm text-fg-muted">
                Chargement…
              </p>
            )}
            {error ? (
              <p className="mt-4 text-center text-sm text-danger">{error}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
