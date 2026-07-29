# tekpi-eink

Cadre photo connecté pour écran e-ink couleur **Pimoroni Inky Frame 7.3"** (PIM773, panneau ACeP 800×480, 7 couleurs).

Deux moitiés qui ne se parlent que par une URL :

- une **web app Next.js sur Vercel** pour uploader, cadrer et gérer les photos ;
- un **script Python sur Raspberry Pi Zero 2 W** qui récupère l'image du moment et rafraîchit l'écran.

## Comment ça marche

1. **Upload** : la photo est compressée côté client (max 1800 px, JPEG), puis stockée dans Vercel Blob sous `originals/` avec un nom de base unique.
2. **Cadrage** : un clic sur la vignette ouvre un éditeur (cropperjs, ratio 5:3, rotation). À la validation, `/api/store-display` écrit :
   - `crops/<base>.jpg` : la version cadrée affichée dans la galerie ;
   - `display/<base>.png` : le PNG 800×480 **pré-dithé** vers la palette ACeP (Floyd-Steinberg serpentin, distance calculée sur les couleurs réellement affichées par le panneau, voir `lib/dither.ts`).
3. **Affichage** : le Pi appelle `/api/next-image` (cron), qui choisit une image selon la configuration et renvoie le PNG prêt à afficher. Le Pi ne calcule rien.

La configuration (ordre de rotation, intervalle, image épinglée) est persistée en JSON dans le Blob : pas de base de données.

## Route `/api/next-image`

- `GET` → PNG 800×480, `Content-Type: image/png`.
- Rotation **séquentielle** ou **aléatoire** par tranche horaire (1, 2, 4, 8 ou 24 h), sans état serveur, ou **image fixe**.
- Supporte `If-None-Match` : réponse `304` si l'image du moment n'a pas changé, ce qui évite au Pi un refresh ACeP inutile (une trentaine de secondes de flashs).

## Développement local

```bash
npm install
npm run dev
```

Créer un `.env.local` avec :

```
BLOB_READ_WRITE_TOKEN=   # Vercel Dashboard > Storage > Blob
```

## Côté Raspberry Pi

Le script `pi/update_display.py` (dépendances : `requests`, `pillow`, `inky`) s'exécute via cron, par exemple toutes les heures :

```cron
0 * * * * python3 /home/pi/update_display.py
```

Il mémorise l'ETag de la dernière image affichée dans `/home/pi/.tekpi_etag` et ne rafraîchit l'écran que si l'image a changé. Les erreurs sont journalisées dans `/home/pi/display_error.log`.

## Contraintes matérielles

La palette ACeP est fixe : noir, blanc, vert, bleu, rouge, jaune, orange. Toute autre couleur est approximée grossièrement par le contrôleur, d'où le dithering custom obligatoire (voir `lib/dither.ts` et `CLAUDE.md` pour le détail des contraintes).
