import { AUTH_COOKIE, sessionToken } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

/** Accessibles sans cookie : la page de connexion et son formulaire. */
const PUBLIC_PATHS = ["/login", "/api/login"];

/**
 * Routes que le Raspberry Pi doit joindre. Elles s'authentifient avec un jeton
 * d'en-tête plutôt qu'avec le cookie du site : un appareil sans navigateur ne
 * peut pas suivre une redirection vers un formulaire.
 */
const DEVICE_PATHS = ["/api/state", "/api/next-image", "/api/heartbeat"];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD;
  const deviceToken = process.env.DEVICE_TOKEN;

  const hasSession =
    Boolean(sitePassword) &&
    request.cookies.get(AUTH_COOKIE)?.value ===
      (await sessionToken(sitePassword as string));

  if (DEVICE_PATHS.some((p) => pathname.startsWith(p))) {
    // Sans jeton configuré, on laisse passer : couper le Pi en silence à la
    // première mise en production serait pire que l'absence de protection.
    if (!deviceToken) {
      return NextResponse.next();
    }
    return request.headers.get("x-tekpi-token") === deviceToken || hasSession
      ? NextResponse.next()
      : unauthorized();
  }

  // Le cron de Vercel signe ses appels ; le bouton du site passe, lui, par le
  // cookie et retombe donc sur le contrôle ci-dessous.
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    pathname.startsWith("/api/album/refresh") &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next();
  }

  if (!sitePassword || hasSession) {
    return NextResponse.next();
  }

  return pathname.startsWith("/api/")
    ? unauthorized()
    : NextResponse.redirect(new URL("/login", request.url));
}
