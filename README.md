# tekpi-eink

Cadre photo connecté pour écran e-ink couleur **Pimoroni Inky Impression 7.3"** (800×480), piloté par un Raspberry Pi Zero 2 W. Les deux révisions du matériel sont gérées : ACeP 7 couleurs (PIM673) et Spectra 6 (PIM773, 2025).

Deux moitiés qui ne se parlent que par une URL :

- une **web app Next.js sur Vercel** pour uploader, cadrer et gérer les photos ;
- un **script Python sur Raspberry Pi Zero 2 W** qui récupère l'image du moment et rafraîchit l'écran.

## Comment ça marche

Le Pi n'est qu'une vitrine : il ne compose rien, ne décide rien, et n'affiche
pas le site. Toutes les décisions sont prises en ligne, il vient simplement
demander s'il y a un changement à appliquer.

1. **Upload** : la photo est compressée côté client (max 1800 px, JPEG), puis
   stockée dans Vercel Blob sous `originals/` avec un nom de base unique.
2. **Cadrage** : un clic sur la vignette ouvre un éditeur (cropperjs, ratio 5:3,
   rotation). À la validation, `/api/store-display` écrit `crops/<base>.jpg` et
   `display/<base>.png`, le rendu 800×480 pré-dithé pour la dalle, puis affiche
   un aperçu fidèle de ce que l'écran montrera.
3. **Synchronisation** : le Pi appelle `/api/state` chaque minute. Tant que rien
   ne change, la réponse fait quelques centaines d'octets et l'écran ne bouge
   pas. Dès qu'elle annonce un changement, il récupère le PNG et rafraîchit.

La configuration (rotation, intervalle, saturation, délai de garde) est
persistée en JSON dans le Blob : pas de base de données.

## Boucle de synchronisation

| Endpoint | Appelé par | Rôle |
|---|---|---|
| `GET /api/state` | Pi, chaque minute | Faut-il rafraîchir ? |
| `GET /api/next-image` | Pi, si oui | PNG 800×480 prêt à afficher |
| `POST /api/heartbeat` | Pi | Dalle détectée, révision affichée, erreurs |
| `GET /api/status` | site | État complet de l'onglet Écran |
| `POST /api/force-refresh` | site | « Afficher maintenant » |

La `revision` est un hachage de `pathname + uploadedAt + forceRefreshAt` : elle
change quand l'image du moment change, quand un re-cadrage écrase le blob à URL
identique, et quand on force l'affichage depuis le site.

Un délai de garde configurable empêche deux rafraîchissements rapprochés (un
cycle e-ink dure 20 à 35 s) ; « Afficher maintenant » passe outre.

## Rendu des images

La dalle est **détectée, jamais supposée** : le Pi rapporte son driver via
`inky.auto()` et le serveur dithère vers la palette correspondante. Deux
matériels portent le même nom commercial, avec des palettes différentes
(7 couleurs sur l'ACeP d'origine, 6 sur le Spectra 6 de 2025, sans orange).

Le dithering vise les couleurs que la dalle **rend réellement**, soit le mélange
à parts égales des deux palettes du driver, ce qui reproduit le `saturation=0.5`
par défaut des exemples officiels Pimoroni. Le Pi passe ensuite l'image à
`set_image(img, saturation=0.5)` : PIL retrouve chaque couleur à l'identique et
se contente de l'indexer, sans re-quantifier ni re-dithérer. Viser les primaires
RGB pures serait un piège : le driver ajoute une entrée « clean » de valeur
`[255, 255, 255]` qui capterait tous les blancs.

Les réglages du pipeline (`lib/render.ts`) ont été choisis en mesurant l'écart
colorimétrique moyen (ΔE Lab, après un flou simulant la perception du tramage à
distance de lecture) contre l'image d'origine, sur quatre images de référence.
L'erreur moyenne passe de 9,94 à 3,74 en ACeP 7, et de 9,34 à 5,42 en Spectra 6.

La saturation reste réglable depuis le site : « Fidèle » est le plus proche de
l'original, les crans supérieurs suivent le conseil de Pimoroni quand le rendu
paraît terne. Les images contrastées aux aplats larges rendent nettement mieux
que les dégradés doux et les teintes chair.

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

Le script `pi/update_display.py` (dépendances : `requests`, `pillow`, `inky`)
s'exécute via cron, **toutes les minutes** :

```cron
* * * * * /usr/bin/python3 /home/pi/update_display.py
```

Il mémorise la révision affichée dans `~/.tekpi-state.json` et n'allume la dalle
que si le serveur annonce un changement. Il ne se signale pas à chaque sondage :
seulement après un rafraîchissement, une erreur, ou toutes les dix minutes. Les
erreurs sont journalisées dans `~/tekpi.log`.

## Contraintes matérielles

La palette est figée par le contrôleur : toute couleur hors palette est
approximée grossièrement, d'où le dithering custom obligatoire. Voir
`lib/panels.ts` pour les deux dalles et `CLAUDE.md` pour le détail des
contraintes.
