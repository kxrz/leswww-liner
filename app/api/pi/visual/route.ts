import { isDevice } from "@/lib/auth";
import { saveVisual } from "@/lib/store";

/** The frame uploads the picture it just drew: PUT /api/pi/visual?guid=…, image/png body. */
export async function PUT(request: Request) {
  if (!isDevice(request)) return new Response("Unauthorized", { status: 401 });
  const guid = new URL(request.url).searchParams.get("guid");
  const png = await request.arrayBuffer();
  if (!guid?.startsWith("https://www.320kbps.club/") || png.byteLength === 0 || png.byteLength > 4_000_000) {
    return new Response("Bad request", { status: 400 });
  }
  return Response.json(await saveVisual(guid, png));
}
