import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import satori from "satori";
import sharp from "sharp";
import type { AlbumOfTheDay } from "@/lib/album";
import { ditherToPanel, quantizeToPalette } from "@/lib/dither";
import {
  cssColour,
  paletteColour,
  renderPalette,
  type PanelSpec,
  type RGB,
} from "@/lib/panels";
import { DEFAULT_RENDER, type RenderOptions } from "@/lib/render";

// Géométrie de la mise en page, en pixels de la dalle.
const COVER = { x: 44, y: 68, size: 344 };
const QR = { x: 664, y: 356, size: 92 };

type Element = {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
};

function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Element {
  return { type, props: { style, children } };
}

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

async function loadFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (fontCache) {
    return fontCache;
  }

  // Les polices sont embarquées dans le dépôt : satori vectorise le texte, ce
  // qui supprime toute dépendance aux polices présentes sur l'hôte — la
  // fragilité classique d'un rendu PIL côté Raspberry Pi.
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "DejaVuSans.ttf")),
    readFile(path.join(dir, "DejaVuSans-Bold.ttf")),
  ]);

  fontCache = { regular, bold };
  return fontCache;
}

function hex(colour: RGB): string {
  return `#${colour.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function releaseYear(releaseDate: string): string {
  return /^\d{4}/.exec(releaseDate)?.[0] ?? "";
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function layout(album: AlbumOfTheDay, panel: PanelSpec): Element {
  const black = cssColour(panel, "black");
  const white = cssColour(panel, "white");
  const red = cssColour(panel, "red");
  const year = releaseYear(album.releaseDate);

  const trackRows = album.tracks.slice(0, 6).map((track, index) =>
    el(
      "div",
      {
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        marginBottom: 5,
        color: black,
        fontSize: 15,
      },
      [
        el(
          "div",
          { fontSize: 12, fontWeight: 700, width: 20, opacity: 0.75 },
          String(index + 1).padStart(2, "0"),
        ),
        el(
          "div",
          {
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          truncate(track, 42),
        ),
      ],
    ),
  );

  return el(
    "div",
    {
      width: panel.width,
      height: panel.height,
      display: "flex",
      background: white,
      fontFamily: "DejaVu Sans",
    },
    [
      // Colonne gauche : la pochette est incrustée après coup, on ne réserve
      // que son cadre pour éviter un double encodage de l'image.
      el(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: COVER.x * 2 + COVER.size,
          paddingTop: COVER.y + COVER.size + 18,
        },
        year
          ? el("div", { fontSize: 20, fontWeight: 700, color: black }, year)
          : undefined,
      ),

      el(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          paddingTop: 60,
          paddingRight: 44,
        },
        [
          el(
            "div",
            { display: "flex" },
            el(
              "div",
              {
                background: red,
                color: white,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.2,
                padding: "4px 12px",
                borderRadius: 3,
              },
              "ALBUM DU JOUR",
            ),
          ),

          el(
            "div",
            {
              marginTop: 18,
              fontSize: album.name.length > 26 ? 32 : 40,
              fontWeight: 700,
              lineHeight: 1.15,
              color: black,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            },
            truncate(album.name, 58),
          ),

          el(
            "div",
            {
              marginTop: 6,
              fontSize: 22,
              color: black,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            truncate(album.artist, 34),
          ),

          el("div", {
            marginTop: 16,
            marginBottom: 16,
            width: 64,
            height: 3,
            background: red,
          }),

          el(
            "div",
            { display: "flex", flexDirection: "column" },
            trackRows,
          ),
        ],
      ),
    ],
  );
}

async function renderCover(
  album: AlbumOfTheDay,
  panel: PanelSpec,
  options: RenderOptions,
): Promise<Buffer> {
  const palette = renderPalette(panel);
  const black = paletteColour(panel, "black");

  let source: Buffer | null = null;

  if (album.coverUrl) {
    try {
      const response = await fetch(album.coverUrl, { cache: "no-store" });
      if (response.ok) {
        source = Buffer.from(await response.arrayBuffer());
      }
    } catch {
      source = null;
    }
  }

  const inner = COVER.size - 6;

  const raw = source
    ? await sharp(source)
        .flatten({ background: "#ffffff" })
        .gamma()
        .resize({ width: inner, height: inner, fit: "cover", kernel: "lanczos3" })
        .modulate({
          brightness: options.brightness,
          saturation: options.saturation,
        })
        .sharpen({ sigma: options.sharpenSigma })
        .raw()
        .toBuffer()
    : Buffer.alloc(inner * inner * 3, 128);

  const dithered = await ditherToPanel(
    raw,
    inner,
    inner,
    palette,
    options.errorDiffusion,
  );

  // Filet noir autour de la pochette : sur une dalle claire, une image sans
  // bord se confond avec le fond.
  return sharp({
    create: {
      width: COVER.size,
      height: COVER.size,
      channels: 3,
      background: { r: black[0], g: black[1], b: black[2] },
    },
  })
    .composite([{ input: dithered, left: 3, top: 3 }])
    .png()
    .toBuffer();
}

async function renderQr(url: string, panel: PanelSpec): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: QR.size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: `${hex(paletteColour(panel, "black"))}ff`,
      light: `${hex(paletteColour(panel, "white"))}ff`,
    },
  });
}

/**
 * Couleurs employées par la mise en page. La quantification du texte se fait
 * contre cette liste et non contre la palette complète : les gris
 * d'antialiasing d'une lettre tombent géométriquement plus près du vert ou du
 * bleu que du noir, ce qui entourait chaque caractère d'un liseré coloré.
 */
const LAYOUT_COLOURS = ["black", "white", "red"] as const;

/**
 * Compose l'écran « album du jour ».
 *
 * Seule la pochette est tramée. Le texte et les aplats sont rabattus sur les
 * couleurs exactes de la palette : tramer du texte le rendrait illisible, et
 * laisser les crénelages du rendu vectoriel produirait des gris hors palette
 * que le driver se mettrait à tramer lui-même autour de chaque lettre.
 */
export async function composeAlbum(
  album: AlbumOfTheDay,
  panel: PanelSpec,
  options: RenderOptions = DEFAULT_RENDER,
): Promise<Buffer> {
  const fonts = await loadFonts();

  const svg = await satori(layout(album, panel) as never, {
    width: panel.width,
    height: panel.height,
    fonts: [
      { name: "DejaVu Sans", data: fonts.regular, weight: 400, style: "normal" },
      { name: "DejaVu Sans", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });

  // Sans antialiasing, le texte ne produit aucune couleur intermédiaire :
  // c'est ce qui évite d'avoir à trancher entre noir, rouge et vert pour un
  // gris de bord, et donc le liseré coloré autour de chaque lettre. Du texte
  // crénelé est par ailleurs la norme sur une dalle e-ink à 127 PPI.
  const crisp = svg.replace("<svg ", '<svg shape-rendering="crispEdges" ');

  const { data, info } = await sharp(Buffer.from(crisp))
    .flatten({ background: hex(paletteColour(panel, "white")) })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const flat = quantizeToPalette(
    data,
    info.width,
    info.height,
    LAYOUT_COLOURS.map((name) => paletteColour(panel, name)),
  );

  const [cover, qr] = await Promise.all([
    renderCover(album, panel, options),
    renderQr(album.url, panel),
  ]);

  return sharp(flat, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .composite([
      { input: cover, left: COVER.x, top: COVER.y },
      { input: qr, left: QR.x, top: QR.y },
    ])
    // Sans alpha : la dalle n'en fait rien et un canal supplémentaire
    // compliquerait la vérification des couleurs.
    .removeAlpha()
    .png()
    .toBuffer();
}
