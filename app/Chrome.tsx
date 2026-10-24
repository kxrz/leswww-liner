import Link from "next/link";
import { Ext } from "./Ext";
import { KeyIcon } from "./Icons";
import { Wordmark } from "./Logo";
import { LEGAL, SITE } from "@/lib/site";

type Page = "home" | "gallery" | "control";

/**
 * Sticky header, as on leswww.com: the LesWWW / Liner lockup (home of the project) on the left; on the right the
 * pages, one lemon call to action and a key to the control room.
 */
export function Nav({ current }: { current?: Page }) {
  const here = (page: Page) => (current === page ? ("page" as const) : undefined);
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-current={here("home")}>
            <Wordmark className="wordmark" />
            <span className="lockup-slash" aria-hidden="true">/</span>
            <span className="lockup-product">Liner</span>
            <span className="sr-only">, home</span>
          </Link>
          <nav className="label" aria-label="Main">
            <Link href="/#how" className="hide-mobile">How it works</Link>
            <Link href="/gallery" aria-current={here("gallery")}>Gallery</Link>
            <Ext href={SITE.repo} className="hide-mobile">GitHub</Ext>
            <Ext href={SITE.build} className="block-link">Build yours</Ext>
            <Link href="/control" className="icon-link" aria-current={here("control")} title="Control room">
              <KeyIcon />
              <span className="sr-only">Control room</span>
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p className="slogan">
          <span>Why. What. Which way.</span>
          <span className="label">Liner is a LesWWW project</span>
        </p>
        <nav className="label footer-nav" aria-label="Footer">
          <p>
            <span className="footer-group">Project</span>
            <Link href="/gallery">Gallery</Link>
            <Ext href={SITE.build}>Build guide</Ext>
            <Ext href={SITE.repo}>GitHub</Ext>
            <Ext href={`${SITE.repo}/blob/main/LICENSE`}>MIT License</Ext>
            <Link href="/control" rel="nofollow">Control room</Link>
          </p>
          <p>
            <span className="footer-group">Family</span>
            <Ext href={SITE.studio}>LesWWW</Ext>
            <Ext href={SITE.music}>320kbps.club</Ext>
          </p>
          <p>
            <span className="footer-group">Legal</span>
            {LEGAL.map((l) => (
              <Ext key={l.href} href={l.href}>{l.label}</Ext>
            ))}
          </p>
        </nav>
        <p className="fine">
          © LesWWW {new Date().getFullYear()} · Florent Bertiaux, Lille. Music curated on{" "}
          <Ext href={SITE.music}>320kbps.club</Ext>.
        </p>
      </div>
    </footer>
  );
}
