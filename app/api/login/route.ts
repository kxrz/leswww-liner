import { timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function matches(submitted: string, secret: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.SITE_PASSWORD;

  if (!secret) {
    return NextResponse.json(
      { error: "Aucun mot de passe configuré sur le serveur." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const submitted = String(formData.get("password") ?? "").trim();

  if (!matches(submitted, secret.trim())) {
    return NextResponse.redirect(new URL("/login?erreur=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set({
    name: AUTH_COOKIE,
    value: await sessionToken(secret.trim()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}

/** Déconnexion : le cookie est vidé, la prochaine requête repasse par /login. */
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
