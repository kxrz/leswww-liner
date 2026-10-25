import { isLoggedIn } from "@/lib/auth";
import { readStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Polled by the page while a request is on its way: the id of the last request the frame has handled, and how. */
export async function GET() {
  if (!(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  const status = await readStatus();
  return Response.json({
    handled: status?.command ?? 0,
    artist: status?.artist,
    title: status?.title,
    refused: status?.refused,
    reason: status?.reason,
  });
}
