import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "liner_session";

// Without the variable, the gate stays open only on a developer's machine, never in a deployment:
// a preview missing SITE_PASSWORD would otherwise be an open control room on the production store.
const openWithout = process.env.NODE_ENV !== "production";

/**
 * What the cookie holds: an HMAC of the password, keyed with the device token (a server-only secret).
 * It cannot be cracked offline from the cookie alone, and changing either secret signs everyone out.
 */
export function fingerprint(password: string): string {
  return createHmac("sha256", process.env.DEVICE_TOKEN ?? "liner").update(`session:${password}`).digest("hex");
}

export function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isLoggedIn(): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return openWithout;
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  return same(value, fingerprint(password));
}

export function isDevice(request: Request): boolean {
  const token = process.env.DEVICE_TOKEN;
  if (!token) return openWithout;
  return same(request.headers.get("authorization") ?? "", `Bearer ${token}`);
}
