/**
 * Liner in seven slides, for the /brand page: `node scripts/slides.mjs` writes public/brand.
 *
 * One idea per slide, each shown with a real picture from the frame in its frame mockup. The words live in
 * lib/brand.json, in English and French, read by the page too. Two formats: 16:9 (1920 × 1080) to present, and
 * LinkedIn (1080 × 1350, the carousel portrait). One PNG per slide, and one PDF per language and format: LinkedIn
 * shows a PDF posted as a document as a carousel.
 *
 * Fonts: Big Shoulders and Public Sans from scripts/fonts (OFL), IBM Plex Mono from pi/fonts.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { createElement as h } from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/brand");
const FORMATS = {
  "16x9": { width: 1920, height: 1080 },
  linkedin: { width: 1080, height: 1350 },
};
// The panel and the part the mat leaves visible (lib/frame.ts)
const PANEL = { width: 800, height: 480 };
const VISIBLE = { x0: 52, y0: 35, x1: 748, y1: 480 };

const C = {
  paper: "#ffffff",
  ink: "#0a0a0a",
  inkSoft: "#54565c",
  cream: "#f5f5f2",
  creamSoft: "#b5b7bd",
  tag: "#f0f0f0",
  accent: "#d6ff3f",
  pop3: "#29e5ff",
  wood: "#1b1b1a",
  mat: "#fbfbf8",
};

/** The LESWWW wordmark (Big Shoulders 800, outlined), as in app/Logo.tsx. */
const GLYPHS = [
  [0, "M102 0V1600H380V246H770V0Z"],
  [795, "M102 0V1600H801V1354H380V935H781V690H380V246H801V0Z"],
  [1651, "M491 -19Q276 -19 180.0 69.5Q84 158 75 364Q74 400 74.0 440.0Q74 480 76.0 520.5Q78 561 82 597H345Q341 521 340.0 448.5Q339 376 345 313Q349 262 386.0 235.5Q423 209 491 209Q555 209 590.0 235.5Q625 262 631 313Q635 349 636.0 385.0Q637 421 635.5 457.0Q634 493 631 528Q627 576 596.0 612.0Q565 648 514 659L342 699Q241 722 182.0 771.0Q123 820 97.0 894.5Q71 969 68 1069Q67 1116 67.0 1156.0Q67 1196 68 1238Q74 1374 118.5 1458.0Q163 1542 254.0 1580.5Q345 1619 491 1619Q704 1619 799.5 1531.0Q895 1443 903 1238Q905 1192 903.5 1128.0Q902 1064 899 1007H632Q635 1079 636.0 1149.0Q637 1219 634 1289Q632 1339 595.5 1365.5Q559 1392 490 1392Q425 1392 388.5 1365.5Q352 1339 347 1289Q341 1234 341.0 1179.0Q341 1124 347 1069Q351 1022 374.0 987.5Q397 953 448 941L601 909Q711 885 777.5 834.5Q844 784 875.5 707.5Q907 631 911 528Q912 502 912.0 474.0Q912 446 911.0 418.0Q910 390 909 364Q901 158 804.0 69.5Q707 -19 491 -19Z"],
  [2630, "M190 0 44 1600H324L374 888L406 246H495L498 888L628 1590H1029L1159 888L1162 246H1251L1283 888L1333 1600H1613L1467 0H971L900 458L872 1354H785L757 458L686 0Z"],
  [4287, "M190 0 44 1600H324L374 888L406 246H495L498 888L628 1590H1029L1159 888L1162 246H1251L1283 888L1333 1600H1613L1467 0H971L900 458L872 1354H785L757 458L686 0Z"],
  [5944, "M190 0 44 1600H324L374 888L406 246H495L498 888L628 1590H1029L1159 888L1162 246H1251L1283 888L1333 1600H1613L1467 0H971L900 458L872 1354H785L757 458L686 0Z"],
];

const dataUri = (type, data) => `data:${type};base64,${Buffer.from(data).toString("base64")}`;

function wordmark(height, fill) {
  const width = Math.round((height * 7848) / 2031);
  const paths = GLYPHS.map(([x, d]) => `<path transform="translate(${x} 0)" d="${d}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 7848 2031"><g fill="${fill}" transform="translate(94.6 1815.6) scale(1 -1)">${paths}</g></svg>`;
  return h("img", { src: dataUri("image/svg+xml", svg), width, height });
}

const mono = (text, size, color, style = {}) =>
  h("div", { style: { display: "flex", fontFamily: "IBM Plex Mono", fontSize: size, letterSpacing: "0.04em", textTransform: "uppercase", color, ...style } }, text);

/** The LesWWW / Liner lockup of the site's header. */
const lockup = (size, color) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: size * 0.35 } },
    wordmark(size, color),
    h("div", { style: { display: "flex", fontFamily: "Big Shoulders", fontWeight: 800, fontSize: size * 1.25, lineHeight: 1, color } }, "/ LINER"),
  );

/** The frame mockup (app/Frame.tsx): black wood, white mat, then only the visible part of the panel. */
function frame(width, picture) {
  const wood = Math.round(width * 0.045);
  const matX = Math.round(width * 0.075);
  const matY = Math.round(width * 0.07);
  const screenW = width - 2 * (wood + matX);
  const visibleW = VISIBLE.x1 - VISIBLE.x0;
  const visibleH = VISIBLE.y1 - VISIBLE.y0;
  const screenH = Math.round((screenW * visibleH) / visibleW);
  const scale = screenW / visibleW;
  return h(
    "div",
    { style: { display: "flex", padding: wood, background: C.wood, boxShadow: "0 24px 48px -24px rgba(0,0,0,0.6)" } },
    h(
      "div",
      { style: { display: "flex", padding: `${matY}px ${matX}px`, background: C.mat } },
      h(
        "div",
        { style: { display: "flex", position: "relative", width: screenW, height: screenH, overflow: "hidden", background: "#d9d9d4" } },
        h("img", {
          src: picture,
          width: Math.round(PANEL.width * scale),
          height: Math.round(PANEL.height * scale),
          style: { position: "absolute", left: -Math.round(VISIBLE.x0 * scale), top: -Math.round(VISIBLE.y0 * scale) },
        }),
      ),
    ),
  );
}

function slide(size, s, n, total, picture) {
  const portrait = size.height > size.width;
  const dark = n === 1 || n === total; // the first and last slides on ink, the others on paper
  const fg = dark ? C.cream : C.ink;
  const soft = dark ? C.creamSoft : C.inkSoft;
  const unit = portrait ? size.width : size.height;
  const pad = Math.round(unit * (portrait ? 0.067 : 0.089));

  const tag = mono(s.kicker, unit * 0.022, C.ink, {
    background: s.real ? C.pop3 : dark ? C.accent : C.tag,
    borderRadius: 999,
    padding: `${unit * 0.006}px ${unit * 0.018}px`,
  });
  const words = h(
    "div",
    { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", width: portrait ? "100%" : size.width * 0.4 } },
    tag,
    h(
      "div",
      { style: { display: "flex", fontFamily: "Big Shoulders", fontWeight: 800, fontSize: unit * (portrait ? 0.072 : 0.098), lineHeight: 1, textTransform: "uppercase", marginTop: unit * 0.03, color: fg } },
      s.title,
    ),
    h("div", { style: { display: "flex", fontSize: unit * (portrait ? 0.028 : 0.029), lineHeight: 1.4, marginTop: unit * (portrait ? 0.022 : 0.028), color: soft } }, s.text),
    s.cta
      ? mono(s.cta, unit * 0.021, C.ink, { background: C.accent, padding: `${unit * 0.01}px ${unit * 0.016}px`, marginTop: unit * 0.035 })
      : null,
  );
  const picture_ = frame(Math.round(size.width * (portrait ? 0.7 : 0.47)), picture);

  return h(
    "div",
    { style: { width: size.width, height: size.height, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: pad, background: dark ? C.ink : C.paper, color: fg, fontFamily: "Public Sans" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, lockup(unit * 0.03, fg), mono(`${n} / ${total}`, unit * 0.02, soft)),
    portrait
      ? // Top-aligned: in a carousel the picture stays put from one slide to the next
        h("div", { style: { display: "flex", flexDirection: "column", gap: unit * 0.045, marginTop: unit * 0.04, marginBottom: "auto" } }, h("div", { style: { display: "flex", justifyContent: "center" } }, picture_), words)
      : h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, words, picture_),
    h("div", { style: { display: "flex", justifyContent: "space-between" } }, mono("liner.leswww.com", unit * 0.02, soft), mono("320kbps.club", unit * 0.02, soft)),
  );
}

/** The RGB pixels of an 8-bit RGBA, non-interlaced PNG (what ImageResponse writes). */
function rgb(png) {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      [width, height] = [data.readUInt32BE(0), data.readUInt32BE(4)];
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("Expected an 8-bit RGBA, non-interlaced PNG");
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff;
    }
    for (let x = 0; x < width; x++) line.copy(out, (y * width + x) * 3, x * 4, x * 4 + 3);
    prev = line;
  }
  return out;
}

/** A PDF with one full-page picture per slide (Flate-compressed RGB). */
function pdf(pngs, width, height) {
  const objects = [];
  const add = (body) => objects.push(body);
  add(null); // 1: catalog
  add(null); // 2: pages
  const pages = [];
  for (const png of pngs) {
    const pixels = deflateSync(rgb(png));
    add(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pixels.length} >>\nstream\n`),
      pixels,
      Buffer.from("\nendstream"),
    ]));
    const image = objects.length;
    const draw = `q ${width} 0 0 ${height} 0 0 cm /I Do Q`;
    add(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    const content = objects.length;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /I ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    pages.push(objects.length);
  }
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pages.map((p) => `${p} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  const chunks = [Buffer.from("%PDF-1.4\n")];
  const offsets = [];
  let length = chunks[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from("\nendobj\n")]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  return Buffer.concat([...chunks, Buffer.from(xref)]);
}

const { slides } = JSON.parse(await readFile(join(ROOT, "lib/brand.json"), "utf8"));
const LOCALES = ["en", "fr"];
const fonts = [
  { name: "Big Shoulders", data: await readFile(join(ROOT, "scripts/fonts/BigShoulders-800.woff")), weight: 800, style: "normal" },
  { name: "Public Sans", data: await readFile(join(ROOT, "scripts/fonts/PublicSans-600.woff")), weight: 600, style: "normal" },
  { name: "IBM Plex Mono", data: await readFile(join(ROOT, "pi/fonts/IBMPlexMono-Regular.ttf")), weight: 400, style: "normal" },
];
const pictures = await Promise.all(slides.map(async (s) => dataUri("image/png", await readFile(join(ROOT, s.picture)))));

await mkdir(OUT, { recursive: true });
for (const locale of LOCALES) {
  for (const [format, size] of Object.entries(FORMATS)) {
    const pngs = [];
    for (const [i, s] of slides.entries()) {
      const words = { ...s[locale], real: s.real };
      const png = Buffer.from(await new ImageResponse(slide(size, words, i + 1, slides.length, pictures[i]), { ...size, fonts }).arrayBuffer());
      await writeFile(join(OUT, `liner-slide-${i + 1}-${locale}-${format}.png`), png);
      pngs.push(png);
    }
    await writeFile(join(OUT, `liner-slides-${locale}-${format}.pdf`), pdf(pngs, size.width, size.height));
    console.log(`public/brand: ${slides.length} slides and a PDF, ${locale}, ${format}`);
  }
}
