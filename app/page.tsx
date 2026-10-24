import { login, send } from "./actions";
import { isLoggedIn } from "@/lib/auth";
import { getItems, type Item } from "@/lib/feed";
import { listVisuals, readCommand, readStatus, slug } from "@/lib/store";

export const dynamic = "force-dynamic";

const time = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function Cover({ item, size }: { item?: Item; size: number }) {
  return item?.cover ? <img src={item.cover} alt="" width={size} height={size} className="cover" /> : <div className="cover" style={{ width: size, height: size }} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;

  if (!(await isLoggedIn())) {
    return (
      <main>
        <h1>Cadre</h1>
        <form action={login} className="login">
          <input type="password" name="password" placeholder="Mot de passe" autoFocus required />
          <button type="submit">Entrer</button>
        </form>
        {params.erreur && <p className="note">Mot de passe incorrect.</p>}
      </main>
    );
  }

  const [items, status, command, visuals] = await Promise.all([getItems(), readStatus(), readCommand(), listVisuals()]);
  const pending = command && command.id > (status?.command ?? 0);
  const shown = status ? visuals.get(slug(status.guid)) : undefined;

  return (
    <main>
      <header>
        <h1>Cadre</h1>
        <span className="mono">320kbps.club</span>
      </header>

      <section className="now">
        <p className="mono label">à l&apos;écran</p>
        {shown && (
          <a href={shown.url} className="visual">
            <img src={`${shown.url}?v=${status?.at}`} alt={`${status?.artist} — ${status?.title}`} width={800} height={480} />
          </a>
        )}
        {status ? (
          <div className="caption">
            <div>
              <p className="artist">{status.artist}</p>
              <p className="title">{status.title}</p>
              <p className="mono">{[status.place, `depuis ${time.format(new Date(status.at))}`].filter(Boolean).join(" · ")}</p>
            </div>
            {shown && <a href={shown.downloadUrl} className="download">PNG ↓</a>}
          </div>
        ) : (
          <p className="mono">pas encore de nouvelles du cadre</p>
        )}
      </section>

      {(params.envoye || pending) && (
        <p className="note">Demande envoyée. Le cadre la prend en compte dans la minute, puis met environ 30 secondes à se redessiner.</p>
      )}

      <form action={send} className="actions">
        <button name="action" value="next">Titre suivant</button>
        <button name="action" value="refresh" className="secondary">Rafraîchir</button>
      </form>

      <h2 className="mono label">choisir un titre</h2>
      <ul className="list">
        {items.map((item) => {
          const visual = visuals.get(slug(item.guid));
          return (
            <li key={item.guid} className={item.guid === status?.guid ? "current" : undefined}>
              <form action={send}>
                <input type="hidden" name="guid" value={item.guid} />
                <button name="action" value="show" className="row">
                  <Cover item={item} size={52} />
                  <span>
                    <span className="title">{item.title}</span>
                    <span className="artist">{item.artist}{item.album && <em> · album</em>}</span>
                  </span>
                </button>
              </form>
              {visual && <a href={visual.downloadUrl} className="download small" aria-label={`Télécharger le visuel de ${item.title}`}>PNG</a>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
