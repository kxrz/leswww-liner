import Link from "next/link";
import { Wordmark } from "./Logo";

/** Sticky header, as on leswww.com: the wordmark on the left, mono labels and one lemon block on the right. */
export function Nav({ control = false }: { control?: boolean }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="brand">
          <a href="https://leswww.com" aria-label="leswww.com"><Wordmark className="wordmark" /></a>
          <span className="label">/</span>
          <Link href="/" className="label product">Liner</Link>
        </div>
        <nav className="label">
          <a href="https://www.320kbps.club" className="hide-mobile">320kbps.club</a>
          <a href="https://github.com/kxrz/leswww-liner" className="hide-mobile">GitHub</a>
          {control ? (
            <Link href="/" className="block-link">About Liner</Link>
          ) : (
            <Link href="/control" className="block-link">Control room</Link>
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
        </nav>
        <p className="fine">
          © LesWWW {new Date().getFullYear()} · Florent Bertiaux, Lille. Music curated on{" "}
          <a href="https://www.320kbps.club">320kbps.club</a>.
        </p>
      </div>
    </footer>
  );
}
