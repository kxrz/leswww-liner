import { put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

// Identifiant unique par image : deux uploads du même fichier (IMG_0001.jpg)
// ne doivent jamais entrer en collision, et le matching originals/crops/display
// repose sur ce nom de base.
function uniqueBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const rawBase = lastDot === -1 ? fileName : fileName.slice(0, lastDot);
  const slug = rawBase
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(3).toString("hex");
  return slug ? `${slug}-${suffix}` : suffix;
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(file.type);

  if (!extension) {
    return NextResponse.json(
      { error: "Type MIME non autorisé. Seuls JPEG et PNG sont acceptés." },
      { status: 400 },
    );
  }

  const pathname = `originals/${uniqueBaseName(file.name)}.${extension}`;
  const blob = await put(pathname, file, { access: "public" });

  return NextResponse.json({ url: blob.url }, { status: 201 });
}
