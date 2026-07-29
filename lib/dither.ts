import sharp from "sharp";
import type { RGB } from "@/lib/panels";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 3;
}

/**
 * Dithering Floyd-Steinberg serpentin vers la palette d'une dalle e-ink.
 *
 * `palette` doit contenir les couleurs telles que la dalle les rend
 * (voir renderPalette) : le PNG produit ne contient que ces valeurs exactes,
 * ce qui permet au driver Pimoroni de les remapper sur les bons index sans
 * re-quantifier ni re-dithérer.
 *
 * `errorDiffusion` module la part d'erreur propagée aux voisins : 1.0 donne le
 * Floyd-Steinberg classique (couleur moyenne la plus fidèle, grain maximal),
 * 0.0 supprime le tramage (aplats francs et bandes).
 */
export async function ditherToPanel(
  rawBuffer: Buffer,
  width: number,
  height: number,
  palette: readonly RGB[],
  errorDiffusion: number = 0.9,
): Promise<Buffer> {
  const pixelCount = width * height * 3;
  const pixels = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    pixels[i] = rawBuffer[i];
  }

  const addError = (
    x: number,
    y: number,
    errR: number,
    errG: number,
    errB: number,
  ): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const index = pixelIndex(x, y, width);
    pixels[index] += errR;
    pixels[index + 1] += errG;
    pixels[index + 2] += errB;
  };

  for (let y = 0; y < height; y++) {
    // Balayage serpentin : une ligne sur deux se parcourt de droite à gauche
    // (kernel miroir), ce qui casse les motifs verticaux du Floyd-Steinberg.
    const leftToRight = y % 2 === 0;
    const dir = leftToRight ? 1 : -1;

    for (let step = 0; step < width; step++) {
      const x = leftToRight ? step : width - 1 - step;
      const base = pixelIndex(x, y, width);

      const oldR = clamp(pixels[base], 0, 255);
      const oldG = clamp(pixels[base + 1], 0, 255);
      const oldB = clamp(pixels[base + 2], 0, 255);

      let bestR = palette[0][0];
      let bestG = palette[0][1];
      let bestB = palette[0][2];
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const [pr, pg, pb] of palette) {
        const dr = oldR - pr;
        const dg = oldG - pg;
        const db = oldB - pb;
        const distance = dr * dr + dg * dg + db * db;

        if (distance < bestDistance) {
          bestDistance = distance;
          bestR = pr;
          bestG = pg;
          bestB = pb;
        }
      }

      pixels[base] = bestR;
      pixels[base + 1] = bestG;
      pixels[base + 2] = bestB;

      const errR = (oldR - bestR) * errorDiffusion;
      const errG = (oldG - bestG) * errorDiffusion;
      const errB = (oldB - bestB) * errorDiffusion;

      addError(x + dir, y, errR * (7 / 16), errG * (7 / 16), errB * (7 / 16));
      addError(x - dir, y + 1, errR * (3 / 16), errG * (3 / 16), errB * (3 / 16));
      addError(x, y + 1, errR * (5 / 16), errG * (5 / 16), errB * (5 / 16));
      addError(x + dir, y + 1, errR * (1 / 16), errG * (1 / 16), errB * (1 / 16));
    }
  }

  const output = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    output[i] = Math.round(clamp(pixels[i], 0, 255));
  }

  // Surtout pas de png({ palette: true }) : libimagequant altère les couleurs
  // même avec dither: 0 et quality: 100 (un rouge pur ressort en rgb(144,0,0)),
  // or la correspondance avec la palette de la dalle doit rester exacte.
  return sharp(output, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

/**
 * Rabat chaque pixel sur la couleur de palette la plus proche, sans propager
 * d'erreur. À utiliser pour tout ce qui n'est pas une photo : du texte tramé
 * est illisible, et les crénelages d'un rendu vectoriel produiraient des gris
 * hors palette que le driver se mettrait à tramer lui-même.
 */
export function quantizeToPalette(
  rawBuffer: Buffer,
  width: number,
  height: number,
  palette: readonly RGB[],
): Buffer {
  const output = Buffer.alloc(width * height * 3);

  for (let i = 0; i < output.length; i += 3) {
    const r = rawBuffer[i];
    const g = rawBuffer[i + 1];
    const b = rawBuffer[i + 2];

    let bestDistance = Number.POSITIVE_INFINITY;
    let best = palette[0];

    for (const colour of palette) {
      const dr = r - colour[0];
      const dg = g - colour[1];
      const db = b - colour[2];
      const distance = dr * dr + dg * dg + db * db;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = colour;
      }
    }

    output[i] = best[0];
    output[i + 1] = best[1];
    output[i + 2] = best[2];
  }

  return output;
}
