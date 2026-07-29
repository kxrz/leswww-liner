import sharp from "sharp";

export const ACEP_PALETTE: [number, number, number][] = [
  [0, 0, 0],
  [255, 255, 255],
  [0, 255, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 255, 0],
  [255, 128, 0],
];

// Couleurs telles que le panneau ACeP les affiche réellement (valeurs issues
// de la bibliothèque Inky de Pimoroni). Le panneau est nettement plus terne
// que les valeurs RGB pures envoyées au contrôleur.
const MEASURED_PALETTE: [number, number, number][] = [
  [57, 48, 57],
  [255, 255, 255],
  [58, 91, 70],
  [61, 59, 94],
  [156, 72, 75],
  [208, 190, 71],
  [177, 106, 73],
];

// 0 = distance sur les couleurs pures, 1 = distance sur les couleurs mesurées.
// La distance se calcule dans cet espace mélangé pour compenser la fadeur du
// panneau, mais le PNG contient toujours les valeurs pures de ACEP_PALETTE.
const MEASURED_BLEND = 0.5;

const COMPARISON_PALETTE: [number, number, number][] = ACEP_PALETTE.map(
  ([r, g, b], i) => {
    const [mr, mg, mb] = MEASURED_PALETTE[i];
    return [
      r + (mr - r) * MEASURED_BLEND,
      g + (mg - g) * MEASURED_BLEND,
      b + (mb - b) * MEASURED_BLEND,
    ];
  },
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function findNearestPaletteIndex(r: number, g: number, b: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < COMPARISON_PALETTE.length; i++) {
    const [pr, pg, pb] = COMPARISON_PALETTE[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const distance = dr * dr + dg * dg + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function pixelIndex(x: number, y: number, width: number, channel: number): number {
  return (y * width + x) * 3 + channel;
}

function addError(
  pixels: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  errR: number,
  errG: number,
  errB: number,
): void {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return;
  }

  const index = pixelIndex(x, y, width, 0);
  pixels[index] += errR;
  pixels[index + 1] += errG;
  pixels[index + 2] += errB;
}

// Controls how much of the quantization error is diffused to neighbours.
// 1.0 = classic Floyd-Steinberg (maximum grain), 0.0 = no dithering.
const ERROR_DIFFUSION = 0.65;

export async function ditherToACeP(
  rawBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const pixelCount = width * height * 3;
  const pixels = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    pixels[i] = rawBuffer[i];
  }

  for (let y = 0; y < height; y++) {
    // Balayage serpentin : une ligne sur deux se parcourt de droite à gauche
    // (kernel miroir), ce qui casse les motifs verticaux du Floyd-Steinberg.
    const leftToRight = y % 2 === 0;
    const dir = leftToRight ? 1 : -1;

    for (let step = 0; step < width; step++) {
      const x = leftToRight ? step : width - 1 - step;
      const baseIndex = pixelIndex(x, y, width, 0);

      const oldR = clamp(pixels[baseIndex], 0, 255);
      const oldG = clamp(pixels[baseIndex + 1], 0, 255);
      const oldB = clamp(pixels[baseIndex + 2], 0, 255);

      const paletteIndex = findNearestPaletteIndex(oldR, oldG, oldB);
      const [outR, outG, outB] = ACEP_PALETTE[paletteIndex];
      const [cmpR, cmpG, cmpB] = COMPARISON_PALETTE[paletteIndex];

      pixels[baseIndex] = outR;
      pixels[baseIndex + 1] = outG;
      pixels[baseIndex + 2] = outB;

      // L'erreur se mesure contre la couleur perçue (palette mélangée), pas
      // contre la valeur pure écrite dans le PNG.
      const errR = (oldR - cmpR) * ERROR_DIFFUSION;
      const errG = (oldG - cmpG) * ERROR_DIFFUSION;
      const errB = (oldB - cmpB) * ERROR_DIFFUSION;

      addError(pixels, x + dir, y, width, height, errR * (7 / 16), errG * (7 / 16), errB * (7 / 16));
      addError(pixels, x - dir, y + 1, width, height, errR * (3 / 16), errG * (3 / 16), errB * (3 / 16));
      addError(pixels, x, y + 1, width, height, errR * (5 / 16), errG * (5 / 16), errB * (5 / 16));
      addError(pixels, x + dir, y + 1, width, height, errR * (1 / 16), errG * (1 / 16), errB * (1 / 16));
    }
  }

  const output = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    output[i] = Math.round(clamp(pixels[i], 0, 255));
  }

  return sharp(output, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .png()
    .toBuffer();
}
