export type PanelId = "acep7" | "spectra6";

export type RGB = readonly [number, number, number];

export interface PanelSpec {
  id: PanelId;
  label: string;
  colours: number;
  width: number;
  height: number;
  /** DESATURATED_PALETTE du driver Pimoroni : les primaires RGB pures. */
  pure: readonly RGB[];
  /** SATURATED_PALETTE du driver : ce que la dalle affiche réellement. */
  measured: readonly RGB[];
  /** Fragments de nom de classe renvoyés par inky.auto() pour ce panneau. */
  driverHints: readonly string[];
}

// Mélange appliqué entre les deux palettes du driver. 0.5 est la valeur par
// défaut de set_image(saturation=...) chez Pimoroni : le Pi doit passer la
// même, sinon les couleurs du PNG ne tombent plus sur les bons index.
export const PANEL_SATURATION = 0.5;

export const PANELS: Record<PanelId, PanelSpec> = {
  // Inky Impression 7.3" d'origine (PIM673), driver inky_ac073tc1a.py.
  acep7: {
    id: "acep7",
    label: 'Inky Impression 7.3" ACeP (7 couleurs)',
    colours: 7,
    width: 800,
    height: 480,
    pure: [
      [0, 0, 0],
      [255, 255, 255],
      [0, 255, 0],
      [0, 0, 255],
      [255, 0, 0],
      [255, 255, 0],
      [255, 140, 0],
    ],
    measured: [
      [0, 0, 0],
      [217, 242, 255],
      [3, 124, 76],
      [27, 46, 198],
      [245, 80, 34],
      [255, 255, 68],
      [239, 121, 44],
    ],
    driverHints: ["ac073", "impressions_7", "impression73"],
  },
  // Inky Impression 7.3" 2025 Edition (PIM773), panneau Spectra 6,
  // driver inky_e673.py : pas d'orange, et l'index natif 4 est sauté.
  spectra6: {
    id: "spectra6",
    label: 'Inky Impression 7.3" Spectra 6 (6 couleurs)',
    colours: 6,
    width: 800,
    height: 480,
    pure: [
      [0, 0, 0],
      [255, 255, 255],
      [255, 255, 0],
      [255, 0, 0],
      [0, 0, 255],
      [0, 255, 0],
    ],
    measured: [
      [0, 0, 0],
      [161, 164, 165],
      [208, 190, 71],
      [156, 72, 75],
      [61, 59, 94],
      [58, 91, 70],
    ],
    driverHints: ["e673", "spectra"],
  },
};

export const DEFAULT_PANEL: PanelId = "acep7";

export function isPanelId(value: unknown): value is PanelId {
  return value === "acep7" || value === "spectra6";
}

export function panelFromDriverName(driver: string): PanelId | null {
  const needle = driver.toLowerCase();

  for (const panel of Object.values(PANELS)) {
    if (panel.driverHints.some((hint) => needle.includes(hint))) {
      return panel.id;
    }
  }

  return null;
}

/**
 * Palette réellement écrite dans le PNG : le mélange des deux palettes du
 * driver, reproduit à l'identique (troncature entière comprise).
 *
 * Dithérer vers ces valeurs plutôt que vers les primaires pures est ce qui
 * garantit que PIL les remappe sur le bon index. Le blanc pur (255,255,255)
 * est ambigu — le driver ajoute une entrée « clean » de cette exacte valeur
 * en fin de palette, qui capte le blanc et le sort des couleurs affichables.
 */
export function renderPalette(
  panel: PanelSpec,
  saturation: number = PANEL_SATURATION,
): RGB[] {
  return panel.pure.map((pure, index) => {
    const measured = panel.measured[index];
    return [
      Math.trunc(measured[0] * saturation + pure[0] * (1 - saturation)),
      Math.trunc(measured[1] * saturation + pure[1] * (1 - saturation)),
      Math.trunc(measured[2] * saturation + pure[2] * (1 - saturation)),
    ] as const;
  });
}
