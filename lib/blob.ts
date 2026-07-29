import { list, type ListBlobResult } from "@vercel/blob";

export async function listOriginals(): Promise<ListBlobResult> {
  return list({ prefix: "originals/" });
}

export async function listCrops(): Promise<ListBlobResult> {
  return list({ prefix: "crops/" });
}

export async function listDisplay(): Promise<ListBlobResult> {
  return list({ prefix: "display/" });
}
