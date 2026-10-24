"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, fingerprint, isLoggedIn } from "@/lib/auth";
import { writeCommand, type Command } from "@/lib/store";

export async function login(form: FormData) {
  const password = process.env.SITE_PASSWORD;
  if (password && form.get("password") === password) {
    (await cookies()).set(COOKIE, fingerprint(password), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/");
  }
  redirect("/?erreur=1");
}

export async function send(form: FormData) {
  if (!(await isLoggedIn())) redirect("/");
  const action = form.get("action");
  if (action !== "next" && action !== "refresh" && action !== "show") redirect("/");
  const command: Command = { id: Date.now(), action };
  const guid = form.get("guid");
  if (action === "show" && typeof guid === "string") command.guid = guid;
  await writeCommand(command);
  redirect("/?envoye=1");
}
