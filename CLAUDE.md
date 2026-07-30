# CLAUDE.md — tekpi-eink

## Projet

Affichage dynamique sur écran e-ink couleur Pimoroni Inky Impression 7.3" (PIM773).
Architecture : Next.js App Router déployé sur Vercel + script Python sur Raspberry Pi Zero 2 W.

## Stack

- **Framework** : Next.js 14+ App Router (TypeScript strict)
- **Style** : Tailwind CSS, mobile-first, thème clair neutre (tokens dans `globals.css`)
- **Stockage** : Vercel Blob (`@vercel/blob`)
- **Traitement image** : Sharp + dithering Floyd-Steinberg custom (voir `lib/dither.ts`)
- **Déploiement** : Vercel (plan hobby acceptable)

## Contraintes impératives

### La palette dépend de la dalle — ne jamais la coder en dur

Deux matériels portent le nom « Inky Impression 7.3" » :

| Dalle | Produit | Driver Pimoroni | Couleurs |
|---|---|---|---|
| ACeP 7 | PIM673 | `inky_ac073tc1a.py` | noir, blanc, vert, bleu, rouge, jaune, orange |
| Spectra 6 | PIM773 (2025) | `inky_e673.py` | noir, blanc, jaune, rouge, bleu, vert (**pas d'orange**) |

Les deux sont décrits dans `lib/panels.ts`. La dalle n'est **jamais** supposée :
le Pi la détecte avec `inky.auto()`, envoie le nom de classe du driver à
`/api/heartbeat`, et le serveur dithère vers la palette correspondante.

### Dithérer vers les couleurs rendues, pas vers les primaires pures

`renderPalette()` mélange à parts égales les deux palettes du driver
(`DESATURATED_PALETTE`, les RGB purs, et `SATURATED_PALETTE`, le rendu réel),
ce qui reproduit le `saturation=0.5` par défaut de `set_image()`. Le PNG
contient ces couleurs mélangées, et le Pi appelle
`set_image(img, saturation=0.5)` : PIL retrouve chaque couleur à l'identique et
se contente de l'indexer, sans re-quantifier ni re-dithérer.

**Ne pas dithérer vers les primaires pures.** Le driver ajoute une entrée
« clean » de valeur `[255, 255, 255]` en fin de palette : un blanc pur y est
capté et sort des couleurs affichables (vérifié : index 7 au lieu de 1 sur
ACeP, 6 au lieu de 1 sur Spectra).

**Ne pas utiliser** `sharp().png({ palette: true })` : libimagequant altère les
couleurs même avec `dither: 0` et `quality: 100` (un rouge pur ressort en
`rgb(144,0,0)`), ce qui casse la correspondance exacte avec la palette.

### Route `/api/next-image`

- Sortie : PNG, `Content-Type: image/png`
- Headers : `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` + `ETag`
- Dimensions exactes : 800 × 480 px, mode `cover`
- Sert les PNG pré-dithés de `display/` — aucun traitement d'image au moment du GET
- Rotation sans état serveur, par tranche horaire `slot = Math.floor(Date.now() / (intervalHours * 3600 * 1000))` : séquentiel (`slot % n`), aléatoire (RNG seedé par `slot`), ou image fixe (config)
- Supporte `If-None-Match` → `304` si l'image du moment n'a pas changé (le Pi évite un refresh ACeP inutile)

### Boucle de synchronisation Pi ↔ serveur

Toute la décision est prise en ligne ; le Pi obéit. Le cron le réveille
chaque minute :

1. `GET /api/state?revision=<affichée>` → `{ refresh, revision, reason, retryAfterSeconds, pollSeconds }`
2. si `refresh`, `GET /api/next-image` puis `set_image()` + `show()`
3. `POST /api/heartbeat` après un rafraîchissement, une erreur, ou toutes les 10 min

**Le cron tourne à la minute mais la cadence réelle vient du serveur** :
`pollSeconds` est mémorisé par le Pi, qui s'arrête aussitôt si le délai n'est
pas écoulé. `config.pollMinutes` se règle donc depuis le site sans toucher au
crontab. Un sondage sans changement ne transfère que quelques centaines
d'octets et n'allume pas la dalle. Les écritures dans le Blob sont limitées au
heartbeat.

`revision` = `sha1(pathname + uploadedAt + forceRefreshAt)` : elle change quand
l'image du moment change, quand un re-cadrage écrase le blob à URL identique,
et quand « Afficher maintenant » est déclenché depuis le site.

**Pas de cron Vercel pour la synchronisation** : le plan hobby les limite à une
exécution par jour, déclenchée n'importe quand dans l'heure demandée. Le cron
quotidien de `vercel.json` ne sert qu'à l'album du jour.

### Usure de la dalle

Une dalle e-ink a un nombre de cycles fini. `state.refreshCount` est incrémenté
à chaque heartbeat marqué `refreshed`, et affiché dans l'onglet Écran avec la
moyenne quotidienne : **on ne surveille pas une usure qu'on ne compte pas.**
`config.minRefreshMinutes` (15 par défaut) est le garde-fou contre les cycles
rapprochés ; le vrai risque n'est pas l'usage normal mais l'accident.

### Journal

`lib/journal.ts` tient un tampon circulaire de 120 entrées dans le Blob,
alimenté par les deux côtés : le Pi joint ses événements du cycle au heartbeat
(`events`), le serveur ajoute les siens via `logServer()`. Consultable dans
l'onglet Écran, replié et chargé à la demande par `/api/journal` — hors de
`/api/status` pour ne pas alourdir le sondage.


### Mode « album du jour »

Playlist Spotify **publique et personnelle** uniquement : depuis le 27 novembre
2024, les playlists éditoriales et algorithmiques sont fermées aux nouvelles
applications. `/v1/playlists/{id}/tracks` est devenu `/items` le 11 février
2026 (`lib/spotify.ts` tente le nouveau puis retombe sur l'ancien).

- Flux *Client Credentials*, aucune connexion utilisateur.
- Catalogue mis en cache dans le Blob ; une panne Spotify ne vide pas l'écran.
- Sélection **fonction de la date**, jamais `Math.random()` : même jour, même
  album, quel que soit le nombre d'exécutions.
- Cron Vercel quotidien (`vercel.json`), ce que le plan hobby autorise.

### Composer une image, pas seulement la tramer

Pour tout écran composé (texte, aplats, pochette) :

- **Ne jamais tramer du texte.** Illisible à cette résolution.
- Rendre le texte **sans antialiasing** (`shape-rendering="crispEdges"` injecté
  dans le SVG de satori). Sinon les gris de bord tombent plus près du vert ou
  du rouge que du noir, et chaque lettre s'entoure d'un liseré coloré.
- Quantifier les aplats contre **les seules couleurs de la mise en page**, pas
  la palette entière, pour la même raison.
- Ne tramer que les photographies (pochette), avec `ditherToPanel`.
- Se limiter aux couleurs présentes sur les deux dalles (`UNIVERSAL_COLOURS`) :
  l'orange n'existe pas en Spectra 6.
- Le texte est vectorisé par satori avec une police **embarquée dans le dépôt**
  (`assets/fonts/`), déclarée dans `outputFileTracingIncludes`. Aucune
  dépendance aux polices de l'hôte.

### Accès et jetons

`middleware.ts` garde tout le site derrière `SITE_PASSWORD` (cookie `HttpOnly`
de 30 jours). Trois exceptions, dans cet ordre :

1. `/login` et `/api/login`, toujours ouverts ;
2. les routes du Pi (`/api/state`, `/api/next-image`, `/api/heartbeat`), qui
   acceptent l'en-tête `X-Tekpi-Token` comparé à `DEVICE_TOKEN` — un appareil
   sans navigateur ne peut pas suivre une redirection vers un formulaire ;
3. `/api/album/refresh` avec le `Bearer CRON_SECRET` de Vercel.

L'indexation est bloquée en trois endroits, sans configuration :
`app/robots.ts`, l'en-tête `X-Robots-Tag` de `next.config.ts` (posé sur toutes
les réponses, redirections comprises) et la balise `robots` de `app/layout.tsx`.
`/robots.txt` doit rester dans `PUBLIC_PATHS`, sinon un moteur est redirigé
vers `/login` et ne lit jamais la consigne.

**Chaque protection est facultative et échoue en mode ouvert** : sans la
variable correspondante, la route passe. Couper le cadre en silence à la
première mise en production serait pire que l'absence de protection ; le
défaut de configuration est donc signalé dans l'interface, pas masqué.

### Performance Vercel (plan hobby)

- Mémoire fonction : max ~256MB. Traiter l'image entièrement en mémoire est OK pour 800×480 (≈1.1MB raw).
- Timeout fonction : 10s sur hobby. Sharp est rapide, le dithering JS sur 384 000 pixels aussi.

## Structure des fichiers

```
app/
  layout.tsx
  page.tsx                 ← compose AppShell (onglets Écran / Bibliothèque / Réglages)
  globals.css              ← tokens de design + classes .card/.badge/.btn/.chip
  api/
    state/route.ts         ← GET, décision de rafraîchissement pour le Pi
    heartbeat/route.ts     ← POST, le Pi rapporte dalle + révision affichée
    status/route.ts        ← GET, état complet pour l'onglet Écran du site
    journal/route.ts       ← GET, journal (chargé à la demande, pas au sondage)
    force-refresh/route.ts ← POST, « Afficher maintenant »
    next-image/route.ts    ← GET, PNG pré-dithé pour le Pi (ETag/304)
    upload/route.ts        ← POST, upload vers Blob originals/ (nom de base unique)
    store-display/route.ts ← POST, écrit crops/<base>.jpg + display/<base>.png dithé
    redither/route.ts      ← POST, recalcule un display/ après changement de dalle
    save-config/route.ts   ← POST, persiste la config validée
    login/route.ts         ← POST mot de passe, DELETE déconnexion
    album/refresh/route.ts ← GET/POST, calcule et publie l'album du jour (cron)
components/
  AppShell.tsx             ← "use client", navigation par onglets
  ScreenPanel.tsx          ← "use client", état live + aperçu + afficher maintenant
  JournalPanel.tsx         ← "use client", journal replié, chargé à la demande
  Icons.tsx                ← SVG inline, aucune dépendance d'icônes
  UploadForm.tsx           ← "use client", compression canvas + POST upload
  Gallery.tsx              ← server component, liste + suppression via server action
  GalleryClient.tsx        ← "use client", grille, modal d'édition, aperçu du rendu
  ImageEditor.tsx          ← "use client", crop/rotate (cropperjs)
  Settings.tsx             ← server component, charge config + images
  SettingsClient.tsx       ← "use client", rotation/intervalle/délai de garde
middleware.ts              ← porte d'entrée : cookie de session ou jeton d'appareil
lib/
  auth.ts                  ← empreinte du mot de passe, état de la protection
  panels.ts                ← dalles supportées, renderPalette(), détection driver
  blob.ts                  ← listOriginals(), listCrops(), listDisplay()
  config.ts                ← AppConfig, getConfig(), saveConfig() (JSON dans Blob)
  state.ts                 ← PiState (dalle, révision affichée, dernier contact)
  journal.ts               ← tampon circulaire d'événements Pi + serveur
  selection.ts             ← selectImage() : image du moment + révision
  current.ts               ← resolveCurrent() : ce qu'il faut afficher, tous modes
  spotify.ts               ← Client Credentials, lecture de playlist publique
  album.ts                 ← cache catalogue, album du jour déterministe
  compose.ts               ← mise en page « album du jour » (satori + tramage)
  dither.ts                ← ditherToPanel(raw, w, h, palette): Promise<Buffer>
pi/
  update_display.py        ← script Pi (référence, non exécuté sur Vercel)
```

**Config et état sont distincts** : `config/settings.json` est l'intention de
l'utilisateur, `state/pi.json` est la réalité rapportée par le Pi.

Le matching entre les trois buckets se fait par nom de base sans extension
(`originals/<base>.jpg` ↔ `crops/<base>.jpg` ↔ `display/<base>.png`) ; le nom
de base est rendu unique à l'upload (slug + suffixe aléatoire).

## Variables d'environnement

`.env.local.example` liste les clés, **`DEPLOIEMENT.md` explique quoi ajouter,
où et pourquoi**. Seule `BLOB_READ_WRITE_TOKEN` est indispensable ; les autres
(`SITE_PASSWORD`, `DEVICE_TOKEN`, `SPOTIFY_*`, `CRON_SECRET`) activent une
fonction ou une protection, et leur absence laisse le projet fonctionner en
mode ouvert. Tenir ces trois fichiers cohérents en ajoutant une variable.

## Conventions de code

- TypeScript strict (`"strict": true` dans tsconfig)
- Pas de `any`
- Server components par défaut — `"use client"` seulement si interaction browser nécessaire
- Server Actions pour les mutations (suppression d'image)
- Pas de commentaires évidents — seulement si la logique est non-triviale (ex : formule de rotation, propagation d'erreur Floyd-Steinberg)

## Ce que Cursor NE doit PAS faire

- Ne pas ajouter de base de données (Prisma, Supabase, etc.) — Vercel Blob suffit
- Ne pas utiliser `sharp().png({ palette: true })` sans le dithering custom
- Ne pas hardcoder le token Blob dans le code source
- Ne pas ajouter de tests unitaires à ce stade
- Ne pas utiliser `Math.random()` pour choisir ce qui s'affiche : toute
  sélection doit être une fonction de la date ou de la tranche horaire, sinon
  le Pi et le site ne voient pas la même chose
