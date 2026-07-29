import sharp from "sharp";
import { ditherToPanel } from "@/lib/dither";
import { renderPalette, type PanelSpec } from "@/lib/panels";

/**
 * Réglages de rendu. Les valeurs par défaut ont été choisies en mesurant
 * l'écart colorimétrique moyen (ΔE en Lab, après un flou simulant la
 * perception du tramage à distance de lecture) entre le rendu dithé et
 * l'image d'origine — pas au jugé.
 */
export interface RenderOptions {
  /** Compense la faible plage dynamique de la dalle. */
  brightness: number;
  saturation: number;
  /** Accentuation après réduction, pour récupérer l'acuité perdue. */
  sharpenSigma: number;
  /** Part de l'erreur de quantification propagée aux voisins. */
  errorDiffusion: number;
}

/**
 * Mesures sur quatre images de référence (photo, scan, dégradé, teintes chair),
 * ΔE Lab moyen contre l'original, plus bas est meilleur :
 *
 * - diffusion 0.65 → 7.09 / 0.9 → 3.74 : sous-diffuser fait perdre la couleur
 *   moyenne et crée des bandes. 1.0 est équivalent mais plus granuleux.
 * - saturation 1.3 → 8.52 contre 1.0 → 3.74 : le boost de saturation dégradait
 *   fortement la fidélité, la palette de rendu compense déjà la dalle.
 * - luminosité 1.1 → 4.24 contre 1.0 → 3.74.
 * - accentuation : neutre sur la fidélité, conservée faible pour l'acuité
 *   perdue en réduisant une photo de 1800 px à 800 px.
 *
 * Total : ΔE 9.94 → 3.74 en ACeP 7, 9.34 → 5.42 en Spectra 6.
 */
export const DEFAULT_RENDER: RenderOptions = {
  brightness: 1.0,
  saturation: 1.0,
  sharpenSigma: 0.5,
  errorDiffusion: 0.9,
};

/**
 * Prépare une image source pour la dalle : cadrage, redimensionnement et
 * dithering vers la palette réellement rendue par le panneau.
 */
export async function renderForPanel(
  source: Buffer,
  panel: PanelSpec,
  options: RenderOptions = DEFAULT_RENDER,
): Promise<Buffer> {
  let pipeline = sharp(source)
    .rotate()
    // Redimensionne en lumière linéaire : sans ça, réduire une image en sRGB
    // assombrit les zones texturées et crée des halos sur les contrastes forts.
    .gamma()
    .resize({
      width: panel.width,
      height: panel.height,
      fit: "cover",
      kernel: "lanczos3",
    });

  if (options.brightness !== 1 || options.saturation !== 1) {
    pipeline = pipeline.modulate({
      brightness: options.brightness,
      saturation: options.saturation,
    });
  }

  if (options.sharpenSigma > 0) {
    pipeline = pipeline.sharpen({ sigma: options.sharpenSigma });
  }

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  return ditherToPanel(
    data,
    info.width,
    info.height,
    renderPalette(panel),
    options.errorDiffusion,
  );
}
