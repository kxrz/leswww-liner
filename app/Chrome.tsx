import Link from "next/link";
import { Logo } from "./Logo";

export function Nav({ control = false }: { control?: boolean }) {
  return (
    <header className="nav wrap">
      <div className="brand">
        <a href="https://leswww.com" className="wordmark">LesWWW</a>
        <span className="slash">/</span>
        <Link href="/" className="product">Liner</Link>
      </div>
      <nav>
        <a href="https://www.320kbps.club" className="navlink">320kbps.club</a>
        {control ? (
          <Link href="/" className="pill muted small">About Liner</Link>
        ) : (
          <Link href="/control" className="pill small">Control room</Link>
        )}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer wrap">
      <a href="https://leswww.com" aria-label="leswww.com"><Logo className="mark" /></a>
      <p>
        Liner is a <a href="https://leswww.com">LesWWW</a> project, playing music curated on{" "}
        <a href="https://www.320kbps.club">320kbps.club</a>.
      </p>
      <p className="links">
        <a href="https://leswww.com">leswww.com</a>
        <a href="https://www.320kbps.club">320kbps.club</a>
        <a href="https://github.com/kxrz/leswww-liner">GitHub</a>
        <a href="https://github.com/kxrz/leswww-liner/blob/main/LICENSE">MIT License</a>
      </p>
      <p className="fine">© LesWWW {new Date().getFullYear()}</p>
    </footer>
  );
}
