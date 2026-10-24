import { isLoggedIn } from "@/lib/auth";
import { readStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Polled by the page while a request is on its way: the id of the last request the frame has drawn. */
export async function GET() {
  if (!(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  return Response.json({ handled: (await readStatus())?.command ?? 0 });
}
