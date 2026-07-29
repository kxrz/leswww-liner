import { ScreenIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const configured = Boolean(process.env.SITE_PASSWORD);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-7">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-bg-subtle">
          <ScreenIcon className="h-5 w-5 stroke-fg" />
        </div>

        <h1 className="mt-4 text-xl font-bold tracking-tight">tekpi</h1>
        <p className="sect-sub mt-1">
          {configured
            ? "Cet espace pilote un écran physique. Un mot de passe est requis."
            : "Aucun mot de passe n'est configuré sur le serveur."}
        </p>

        {configured ? (
          <form action="/api/login" method="post" className="mt-5">
            <label className="field-label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-line-strong"
            />
            {erreur ? (
              <p className="mt-2 text-sm text-danger">Mot de passe incorrect.</p>
            ) : null}
            <button type="submit" className="btn btn-primary mt-4 w-full">
              Entrer
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-fg-muted">
            Définir <code className="font-mono text-xs">SITE_PASSWORD</code> dans
            les variables d&apos;environnement, puis redéployer.
          </p>
        )}
      </div>
    </div>
  );
}
