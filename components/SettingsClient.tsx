"use client";

import { type AppConfig, type RotationMode } from "@/lib/config";
import Image from "next/image";
import { useEffect, useState } from "react";

type FixedImageOption = {
  fileBase: string;
  url: string;
};

type Props = {
  config: AppConfig;
  images: FixedImageOption[];
};

const INTERVAL_OPTIONS: AppConfig["intervalHours"][] = [1, 2, 4, 8, 24];
const MIN_REFRESH_OPTIONS: AppConfig["minRefreshMinutes"][] = [0, 5, 15, 30];

const SATURATION_OPTIONS: {
  value: AppConfig["renderSaturation"];
  label: string;
}[] = [
  { value: 1, label: "Fidèle" },
  { value: 1.15, label: "Léger" },
  { value: 1.3, label: "Vif" },
];

const ROTATION_OPTIONS: { value: RotationMode; label: string }[] = [
  { value: "sequential", label: "Séquentiel" },
  { value: "random", label: "Aléatoire" },
  { value: "fixed", label: "Image fixe" },
];

export default function SettingsClient({ config, images }: Props) {
  const [rotation, setRotation] = useState<RotationMode>(config.rotation);
  // Les anciennes configs stockaient un nom avec extension ; on normalise
  // vers le fileBase pour que la sélection dans la grille corresponde.
  const [fixedImage, setFixedImage] = useState(
    (config.fixedImage ?? "").replace(/\.[^.]+$/, ""),
  );
  const [intervalHours, setIntervalHours] = useState(config.intervalHours);
  const [minRefreshMinutes, setMinRefreshMinutes] = useState(
    config.minRefreshMinutes,
  );
  const [renderSaturation, setRenderSaturation] = useState(
    config.renderSaturation,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) {
      return;
    }

    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      mode: "gallery" as const,
      rotation,
      fixedImage: rotation === "fixed" ? fixedImage || null : null,
      intervalHours,
      minRefreshMinutes,
      renderSaturation,
    };

    try {
      const response = await fetch("/api/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Échec de l'enregistrement.");
      }

      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Échec de l'enregistrement.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-6">
        <p className="field-label">Ordre d&apos;affichage</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ROTATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRotation(option.value)}
              className={`chip ${rotation === option.value ? "chip-active" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {rotation === "fixed" ? (
          images.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">
              Aucune image cadrée disponible.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((image) => (
                <button
                  key={image.fileBase}
                  type="button"
                  onClick={() => setFixedImage(image.fileBase)}
                  className={`relative aspect-[5/3] cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-150 ${
                    fixedImage === image.fileBase
                      ? "border-fg"
                      : "border-transparent opacity-55 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={image.fileBase}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 180px"
                  />
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-6">
            <p className="field-label">Change toutes les</p>
            <div className="mt-3 inline-flex rounded-lg border border-line p-0.5">
              {INTERVAL_OPTIONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setIntervalHours(hours)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    intervalHours === hours
                      ? "bg-fg text-white"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {hours} h
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <p className="field-label">Rendu des couleurs</p>
        <p className="sect-sub mt-1">
          « Fidèle » est le réglage mesuré comme le plus proche de la photo
          d&apos;origine. Pimoroni conseille de monter d&apos;un cran si le
          résultat paraît terne sur la dalle. Après changement, les images
          existantes doivent être recalculées depuis l&apos;onglet Écran.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-line p-0.5">
          {SATURATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRenderSaturation(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                renderSaturation === option.value
                  ? "bg-fg text-white"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          La dalle ne dispose que de six ou sept couleurs : les images
          contrastées, aux aplats larges, rendent nettement mieux que les
          dégradés doux et les teintes chair.
        </p>
      </div>

      <div className="card p-6">
        <p className="field-label">Délai minimal entre deux rafraîchissements</p>
        <p className="sect-sub mt-1">
          Un cycle e-ink dure une trentaine de secondes. Ce délai évite que
          plusieurs réglages d&apos;affilée ne fassent clignoter l&apos;écran.
          Le bouton « Afficher maintenant » passe outre.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-line p-0.5">
          {MIN_REFRESH_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setMinRefreshMinutes(minutes)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                minRefreshMinutes === minutes
                  ? "bg-fg text-white"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {minutes === 0 ? "Aucun" : `${minutes} min`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved ? (
          <span className="text-sm text-fg-muted">
            Enregistré. Le Pi appliquera au prochain sondage.
          </span>
        ) : null}
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
    </div>
  );
}
