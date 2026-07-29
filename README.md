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

La configuration (mode, rotation, intervalle, saturation, délai de garde) est
persistée en JSON dans le Blob : pas de base de données.

## Mode « album du jour »

L'écran peut afficher, à la place de la galerie, un album tiré chaque jour
d'une **playlist Spotify publique que tu as créée**. Depuis le 27 novembre
2024, les playlists éditoriales et algorithmiques de Spotify ne sont plus
lisibles par les applications créées après cette date : seule une playlist
personnelle rendue publique fonctionne.

- L'authentification utilise le flux *Client Credentials*, sans connexion
  utilisateur, avec `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET`.
- Le catalogue de la playlist est mis en cache dans le Blob. Si Spotify est
  injoignable, le cache prend le relais et l'écran ne se vide pas.
- La sélection est une fonction de la date, pas un tirage aléatoire : deux
  exécutions le même jour donnent le même album, chaque album passe une fois
  par cycle, et jamais deux jours de suite.
- Le rendu est composé côté serveur avec satori, qui vectorise le texte : la
  police est embarquée dans le dépôt, il n'y a aucune dépendance aux polices
  installées sur l'hôte.
- Le cron quotidien de Vercel (`vercel.json`) recalcule l'album vers 2 h du
  matin, heure de Paris. Une exécution par jour est exactement ce que le plan
  hobby autorise.

**Seule la pochette est tramée.** Le texte et les aplats sont rendus sans
antialiasing et rabattus sur les couleurs exactes de la palette : tramer du
texte le rendrait illisible, et les gris de bord d'un rendu vectoriel tombent
géométriquement plus près du vert ou du rouge que du noir, ce qui entourerait
chaque lettre d'un liseré coloré.

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

Créer un `.env.local` à partir de `.env.local.example`. Seul
`BLOB_READ_WRITE_TOKEN` est nécessaire pour la galerie.

**Mise en production, variables d'environnement et configuration du Pi :
voir [DEPLOIEMENT.md](DEPLOIEMENT.md)**, qui détaille quoi ajouter, où et
pourquoi.

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

## Accès

Le site pilote un objet physique posé chez toi : il n'a pas vocation à être
ouvert. Définir `SITE_PASSWORD` active une porte d'entrée (cookie `HttpOnly`
valable 30 jours, posé par `/api/login`, vérifié dans `middleware.ts`).

Le Pi, lui, n'a pas de navigateur et ne peut pas suivre une redirection vers un
formulaire : il s'authentifie avec un en-tête `X-Tekpi-Token` sur ses trois
routes (`/api/state`, `/api/next-image`, `/api/heartbeat`), comparé à
`DEVICE_TOKEN`. Le cron de Vercel utilise `CRON_SECRET`, qu'il fournit seul.

**Les deux protections sont facultatives, et c'est un choix assumé** : couper
le cadre en silence à la première mise en production serait pire que l'absence
de protection. Tant que `SITE_PASSWORD` n'est pas défini, le site reste public
et l'onglet Écran affiche un avertissement bien visible.

## Contraintes matérielles

La palette est figée par le contrôleur : toute couleur hors palette est
approximée grossièrement, d'où le dithering custom obligatoire. Voir
`lib/panels.ts` pour les deux dalles et `CLAUDE.md` pour le détail des
contraintes.
