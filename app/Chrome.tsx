import Link from "next/link";
import { Wordmark } from "./Logo";
import { LEGAL } from "@/lib/site";

const BUILD = "https://github.com/kxrz/leswww-liner/blob/main/docs/BUILD.md";

/** Sticky header, as on leswww.com: the wordmark (home of the project) on the left, one lemon call to action on the right. */
export function Nav({ control = false }: { control?: boolean }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="Liner, home">
          <Wordmark className="wordmark" />
          <span className="label">/</span>
          <span className="label product">Liner</span>
        </Link>
        <nav className="label">
          <Link href="/#how" className="hide-mobile">How it works</Link>
          <Link href="/gallery">Gallery</Link>
          <a href="https://github.com/kxrz/leswww-liner" className="hide-mobile">GitHub</a>
          {control ? (
            <Link href="/" className="block-link">About Liner</Link>
          ) : (
            <a href={BUILD} className="block-link">Build yours</a>
          )}
        </nav>
      </div>
    </header>
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
        <nav className="label">
          <a href="https://leswww.com">leswww.com</a>
          <a href="https://www.320kbps.club">320kbps.club</a>
          <a href="https://github.com/kxrz/leswww-liner">GitHub</a>
          <a href="https://github.com/kxrz/leswww-liner/blob/main/LICENSE">MIT License</a>
          <Link href="/control">Control room</Link>
          {LEGAL.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <p className="fine">
          © LesWWW {new Date().getFullYear()} · Florent Bertiaux, Lille. Music curated on{" "}
          <a href="https://www.320kbps.club">320kbps.club</a>.
        </p>
      </div>
    </footer>
  );
}
