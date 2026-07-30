import { list, type ListBlobResultBlob } from "@vercel/blob";

export interface BlobListing {
  blobs: ListBlobResultBlob[];
}

/**
 * `list()` plafonne à 1000 entrées par appel et signale la suite avec un
 * curseur. Sans cette boucle, une bibliothèque qui dépasse ce seuil verrait
 * ses images silencieusement disparaître de la rotation.
 */
async function listAll(prefix: string): Promise<BlobListing> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { blobs };
}

export async function listOriginals(): Promise<BlobListing> {
  return listAll("originals/");
}

export async function listCrops(): Promise<BlobListing> {
  return listAll("crops/");
}

export async function listDisplay(): Promise<BlobListing> {
  return listAll("display/");
}

/**
 * Un nom de base sûr : celui produit par `/api/upload`. Tout ce qui vient du
 * client et sert à construire un chemin de blob doit passer par ici, sinon un
 * nom comme `../config/settings` permettrait d'écrire ailleurs que dans son
 * dossier et d'écraser la configuration.
 */
export function isSafeBase(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 80 &&
    /^[a-z0-9][a-z0-9-]*$/.test(value)
  );
}
