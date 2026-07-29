import SettingsClient from "@/components/SettingsClient";
import { listCrops } from "@/lib/blob";
import { getConfig } from "@/lib/config";

function basenameWithoutExt(pathname: string): string {
  const name = pathname.split("/").pop() ?? pathname;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

export default async function Settings() {
  const [config, { blobs: crops }] = await Promise.all([
    getConfig(),
    listCrops(),
  ]);

  return (
    <SettingsClient
      config={config}
      images={crops.map((blob) => ({
        fileBase: basenameWithoutExt(blob.pathname),
        url: blob.url,
      }))}
    />
  );
}
