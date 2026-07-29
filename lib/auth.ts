export const AUTH_COOKIE = "tekpi_auth";

/**
 * Empreinte déterministe du mot de passe : c'est la valeur du cookie de
 * session. Écrit avec l'API Web Crypto pour être utilisable aussi bien depuis
 * le middleware (runtime edge) que depuis une route Node.
 */
export async function sessionToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`tekpi:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Le site est-il réellement protégé ? Sert à alerter dans l'interface. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.SITE_PASSWORD);
}
