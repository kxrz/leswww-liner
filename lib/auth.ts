import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "cadre";

/** Ce qu'on garde en cookie : une empreinte du mot de passe, jamais le mot de passe lui-même. */
export function fingerprint(password: string): string {
  return createHash("sha256").update(`tekpi:${password}`).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isLoggedIn(): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return true;
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  return same(value, fingerprint(password));
}

export function isDevice(request: Request): boolean {
  const token = process.env.DEVICE_TOKEN;
  if (!token) return true;
  return same(request.headers.get("authorization") ?? "", `Bearer ${token}`);
}
