"use client";

import { CheckIcon, PlusIcon } from "@/components/Icons";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";

function resizeForUpload(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(
        1,
        1800 / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const width = Math.round(img.naturalWidth * scale);
      const height = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Compression échouée"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Compression échouée"));
          }
        },
        "image/jpeg",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Compression échouée"));
    };

    img.src = url;
  });
}

export default function UploadForm() {
  const router = useRouter();
  const [compressedFile, setCompressedFile] = useState<Blob | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0];

    if (!file) {
      setCompressedFile(null);
      setOriginalFileName(null);
      return;
    }

    setCompressing(true);

    try {
      const compressed = await resizeForUpload(file);
      setCompressedFile(compressed);
      setOriginalFileName(file.name);
    } catch (err) {
      setCompressedFile(null);
      setOriginalFileName(null);
      setError(err instanceof Error ? err.message : "Compression échouée");
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);

    if (!compressedFile || !originalFileName) {
      setError("Veuillez sélectionner un fichier.");
      return;
    }

    const formData = new FormData();
    formData.append(
      "file",
      new File([compressedFile], originalFileName, { type: "image/jpeg" }),
    );

    setUploading(true);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Échec de l'envoi.");
      }

      form.reset();
      setCompressedFile(null);
      setOriginalFileName(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  const isIdle = !compressing && !uploading;

  return (
    <form onSubmit={handleSubmit}>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-150 ${
          compressedFile
            ? "border-line-strong bg-bg-subtle"
            : "border-line bg-bg hover:border-line-strong hover:bg-bg-subtle"
        }`}
      >
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="sr-only"
        />

        {compressing ? (
          <span className="text-sm text-fg-muted">Compression en cours…</span>
        ) : compressedFile ? (
          <>
            <CheckIcon className="h-5 w-5 stroke-ok" />
            <span className="max-w-full truncate text-sm font-medium">
              {originalFileName}
            </span>
            <span className="text-xs text-fg-muted">Cliquer pour changer</span>
          </>
        ) : (
          <>
            <PlusIcon className="h-5 w-5 stroke-fg-faint" />
            <span className="text-sm font-medium">Ajouter une image</span>
            <span className="text-xs text-fg-muted">JPEG ou PNG</span>
          </>
        )}
      </label>

      <button
        type="submit"
        className="btn btn-primary mt-3 w-full"
        disabled={!isIdle || !compressedFile}
      >
        {uploading ? "Envoi en cours…" : "Envoyer"}
      </button>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
