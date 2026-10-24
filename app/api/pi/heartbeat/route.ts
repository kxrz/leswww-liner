import { isDevice } from "@/lib/auth";
import { writeHealth } from "@/lib/store";

/** The frame says it is alive, with a few vital signs. */
export async function POST(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { temp?: unknown; uptime?: unknown; version?: unknown };
  await writeHealth({
    at: new Date().toISOString(),
    temp: typeof body.temp === "number" ? body.temp : undefined,
    uptime: typeof body.uptime === "number" ? body.uptime : undefined,
    version: typeof body.version === "string" ? body.version.slice(0, 12) : undefined,
  });
  return new Response(null, { status: 204 });
}
