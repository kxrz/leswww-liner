"use client";

import { type AppConfig, type DisplayMode, type RotationMode } from "@/lib/config";
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
const MIN_REFRESH_OPTIONS: AppConfig["minRefreshMinutes"][] = [0, 5, 15, 30, 60];
const POLL_OPTIONS: AppConfig["pollMinutes"][] = [1, 5, 15, 30];

const SATURATION_OPTIONS: {
  value: AppConfig["renderSaturation"];
  label: string;
}[] = [
  { value: 1, label: "Fidèle" },
  { value: 1.15, label: "Léger" },
  { value: 1.3, label: "Vif" },
];

const MODE_OPTIONS: { value: DisplayMode; label: string; hint: string }[] = [
  { value: "gallery", label: "Galerie", hint: "Tes photos, en rotation." },
  {
    value: "album",
    label: "Album du jour",
    hint: "Un album tiré chaque jour d'une playlist Spotify publique.",
  },
];

const ROTATION_OPTIONS: { value: RotationMode; label: string }[] = [
  { value: "sequential", label: "Séquentiel" },
  { value: "random", label: "Aléatoire" },
  { value: "fixed", label: "Image fixe" },
];

export default function SettingsClient({ config, images }: Props) {
  const [mode, setMode] = useState<DisplayMode>(config.mode);
  const [spotifyPlaylist, setSpotifyPlaylist] = useState(
    config.spotifyPlaylist ?? "",
  );
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
  const [pollMinutes, setPollMinutes] = useState(config.pollMinutes);
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
      mode,
      spotifyPlaylist: spotifyPlaylist.trim() || null,
      rotation,
      fixedImage: rotation === "fixed" ? fixedImage || null : null,
      intervalHours,
      minRefreshMinutes,
      pollMinutes,
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
        <p className="field-label">Ce que l&apos;écran affiche</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`chip ${mode === option.value ? "chip-active" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="sect-sub mt-3">
          {MODE_OPTIONS.find((o) => o.value === mode)?.hint}
        </p>

        {mode === "album" ? (
          <div className="mt-4">
            <label className="field-label" htmlFor="playlist">
              Playlist Spotify publique
            </label>
            <input
              id="playlist"
              type="text"
              value={spotifyPlaylist}
              onChange={(event) => setSpotifyPlaylist(event.target.value)}
              placeholder="https://open.spotify.com/playlist/…"
              className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-line-strong"
            />
            <p className="sect-sub mt-2">
              Doit être une playlist <b>que tu as créée</b> et rendue publique.
              Depuis novembre 2024, Spotify interdit aux nouvelles applications
              de lire ses propres playlists éditoriales. L&apos;album change à
              minuit, heure de Paris. Chaque album passe une fois par cycle et
              jamais deux jours de suite.
            </p>
          </div>
        ) : null}
      </div>

      <div className="card p-6" hidden={mode !== "gallery"}>
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
        <p className="field-label">Cadence et usure de la dalle</p>
        <p className="sect-sub mt-1">
          Une dalle e-ink supporte un nombre fini de rafraîchissements, et un
          cycle dure une trentaine de secondes. Ces deux réglages sont là pour
          la ménager.
        </p>

        <div className="mt-4">
          <p className="field-label">Le Pi vérifie</p>
          <div className="mt-2 inline-flex rounded-lg border border-line p-0.5">
            {POLL_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setPollMinutes(minutes)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  pollMinutes === minutes
                    ? "bg-fg text-white"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {minutes === 1 ? "chaque min" : `${minutes} min`}
              </button>
            ))}
          </div>
          <p className="sect-sub mt-2">
            Détermine le délai entre un changement fait ici et sa prise en
            compte à l&apos;écran. Un sondage ne coûte que quelques centaines
            d&apos;octets et n&apos;allume pas la dalle, mais inutile
            d&apos;interroger plus souvent que nécessaire. Aucune manipulation
            sur le Pi : la valeur lui est transmise.
          </p>
        </div>

        <div className="mt-5">
          <p className="field-label">Délai minimal entre deux rafraîchissements</p>
          <div className="mt-2 inline-flex flex-wrap rounded-lg border border-line p-0.5">
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
          <p className="sect-sub mt-2">
            Garde-fou contre les rafraîchissements rapprochés. Pimoroni situe
            un cycle complet entre 20 et 35 s et conseille de les espacer. Le
            bouton « Afficher maintenant » passe outre. Le compteur de cycles
            est visible dans l&apos;onglet Écran.
          </p>
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
