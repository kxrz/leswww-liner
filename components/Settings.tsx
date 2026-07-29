import SettingsClient from "@/components/SettingsClient";
import { listCrops } from "@/lib/blob";
import { getConfig } from "@/lib/config";
import { basenameWithoutExt } from "@/lib/selection";

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
