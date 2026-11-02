import type { Metadata } from "next";
import { Footer, Nav } from "../Chrome";
import { Ext } from "../Ext";
import brand from "@/lib/brand.json";
import { SITE } from "@/lib/site";

const TITLE = "Liner in seven slides";
const DESCRIPTION =
  "The idea behind Liner, the LesWWW e-ink music frame, in seven slides: one track at a time, picked by a person, where the artist comes from, drawn for e-ink. 16:9 and LinkedIn, PNG and PDF.";
const IMAGE = { url: "/brand/liner-slide-1-16x9.png", width: 1920, height: 1080, alt: brand.slides[0].alt };

// A child page replaces the parent's whole openGraph and twitter objects: spell them out
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/brand" },
  openGraph: {
    type: "website",
    url: "/brand",
    siteName: "Liner · LesWWW",
    locale: "en_GB",
    title: `${TITLE} · Liner`,
    description: DESCRIPTION,
    images: [IMAGE],
  },
  twitter: { card: "summary_large_image", title: `${TITLE} · Liner`, description: DESCRIPTION, images: [IMAGE.url] },
};

/** Made by scripts/slides.mjs from lib/brand.json. */
const FORMATS = [
  { id: "16x9", label: "16:9", what: "1920 × 1080, to present" },
  { id: "linkedin", label: "LinkedIn", what: "1080 × 1350, a carousel" },
] as const;
const file = (n: number, format: string) => `/brand/liner-slide-${n}-${format}.png`;

export default function Brand() {
  return (
    <>
      <Nav />
      <main id="main" tabIndex={-1}>
        <div className="wrap">
          <section className="hero compact">
            <div className="hero-tags">
              <span className="tag tag-live">Brand</span>
              <span className="label">{brand.slides.length} slides · 16:9 and LinkedIn · PNG and PDF</span>
            </div>
            <h1>
              Liner in seven slides, <mark>one idea each.</mark>
            </h1>
            <p className="lede">
              What the frame stands for, each idea shown with a real picture from the wall. Present them in 16:9, or post
              the LinkedIn PDF as a document: LinkedIn turns it into a carousel.
            </p>
            <div className="actions">
              {FORMATS.map((f, i) => (
                <a key={f.id} href={`/brand/liner-slides-${f.id}.pdf`} download className={i ? "btn secondary" : "btn"}>
                  PDF {f.label} <span aria-hidden="true">↓</span>
                  <span className="sr-only">: all seven slides, {f.what}</span>
                </a>
              ))}
            </div>
          </section>

          <ol className="slides">
            {brand.slides.map((s, i) => (
              <li key={s.title}>
                <img src={file(i + 1, "16x9")} alt={`Slide ${i + 1}: ${s.title} ${s.alt}.`} width={1920} height={1080} loading="lazy" />
                <div className="slide-text">
                  <span className="label">{i + 1} / {brand.slides.length} · {s.kicker}</span>
                  <h2>{s.title}</h2>
                  <p>{s.text}</p>
                  <p className="slide-downloads">
                    {FORMATS.map((f) => (
                      <a key={f.id} href={file(i + 1, f.id)} download className="tag download">
                        {f.label}<span className="sr-only">: download slide {i + 1}, {f.what}</span>
                      </a>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="label brand-note">
            Set in Big Shoulders, Public Sans and IBM Plex Mono, after the <Ext href={SITE.studio}>LesWWW</Ext> charter. The
            slides are made by <Ext href={`${SITE.repo}/blob/main/scripts/slides.mjs`}>scripts/slides.mjs</Ext>: change
            lib/brand.json and run it again.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
