# tekpi-eink

Un cadre e-ink posé dans le salon, entièrement consacré à la musique : chaque titre de
[320kbps.club](https://www.320kbps.club) y est présenté comme une œuvre, avec son cartel de musée posé sur la carte
d'où vient l'artiste. Un nouveau titre matin et soir, et une petite page web pour en changer depuis le téléphone.

```
┌──────────────────────────────────────────────┐
│ ░  ┆        ┆         ┆          ┆           │  fond uni, graticule en pointillés
│ ┌────────────┐  ┆  ╭──────╮      ┆           │
│ │  pochette  │    ╱ ::::::: ╲───╮            │  pays voisins au trait fin,
│ │   tramée   │ ──┤ :::: ◎ :::: │  ┆          │  pays d'origine épais et tramé,
│ │            │    ╲ :::::::::  ╱             │  cercle sur la ville
│ ├────────────┤     ╰────────╯   ┆           │
│ │ Balthazar  │  ┆        ┆         ┆          │
│ │ Linger On  │                                │  cartel : artiste, titre,
│ │ 2021 · PIAS│  ┆        ┆         ┆          │  album, année, label, origine
│ └────────────┘▌                               │
└──────────────────────────────────────────────┘
```

- **Le fond et la carte** forment un duotone choisi d'après l'encre dominante de la pochette :
  bleu et blanc, rouge et blanc, vert et blanc, jaune et noir, ou blanc et noir pour une pochette sans couleur franche.
- **La carte** montre le pays de l'artiste, ses voisins et un graticule ; un cercle marque la ville quand l'origine en
  est une. Sans origine dans le flux (les albums), l'artiste est cherché dans MusicBrainz.
- **Le cartel**, carte blanche avec une ombre portée : la pochette tramée sur les six encres, l'artiste, le titre,
  puis album, année, style, label et origine.

## Matériel

- Raspberry Pi Zero 2 W, Raspberry Pi OS Bookworm
- Pimoroni Inky Impression 7,3" **Spectra 6** (800 × 480, six encres : noir, blanc, jaune, rouge, bleu, vert)
- Un cadre photo avec passe-partout, qui masque les bords de l'écran (voir [Zone visible](#zone-visible))

## Comment ça marche

```
   téléphone                Vercel                      Raspberry Pi
 ┌───────────┐  bouton  ┌───────────────┐   GET /api/pi   ┌────────────────┐
 │ page web  │ ───────► │ command.json  │ ◄────────────── │ cadre.py --sync│  chaque minute, 7h–minuit
 └───────────┘          │ (Vercel Blob) │                 └───────┬────────┘
       ▲                │  status.json  │ ◄── POST /api/pi ───────┤ après chaque affichage
       └── « à l'écran » └───────────────┘                         │
                                                          ┌───────┴────────┐
                                                          │ cadre.py       │  7h et 19h
                                                          └────────────────┘
```

Le Pi est derrière la box : Vercel ne peut pas le joindre. C'est donc lui qui interroge la page chaque minute.
Une demande met au plus une à deux minutes à être prise en compte, plus une trentaine de secondes de rafraîchissement de la dalle.

La mise en page est dessinée **sur le Pi**, en Python avec Pillow. Seule la carte est calculée par Vercel
(`/api/map`, un PNG aux encres de la dalle mis en cache par le CDN) : contours des pays et géocodage restent
hors du Pi Zero.

- **7h et 19h** : le prochain titre du flux pas encore affiché.
- **Depuis la page** : « Titre suivant », « Rafraîchir » (même titre, redessiné) ou n'importe quel titre du flux.

Sans connexion à la page (pas de `cadre.env`), le cadre fonctionne seul, matin et soir, sans carte.

## Le dépôt

```
app/                 page mobile (Next.js), routes /api/pi (synchro) et /api/map (carte)
lib/
  feed.ts            lecture du flux RSS de 320kbps.club
  store.ts           command.json et status.json dans Vercel Blob
  auth.ts            mot de passe de la page, jeton du Pi
  map.ts             carte d'origine en duotone : graticule, voisins, pays, ville → PNG
  countries.json     contours des pays (Natural Earth 1:50m, simplifiés)
pi/
  cadre.py           tout le cadre : données, mise en page, affichage, synchro
  fonts/             IBM Plex Sans (variable) et IBM Plex Mono
  systemd/           cadre.timer (7h, 19h) et cadre-sync.timer (chaque minute)
  install.sh         installe les dépendances et les services
  cadre.env.example  adresse de la page et jeton
```

## Installer le Pi

```sh
git clone https://github.com/kxrz/tekpi-eink.git ~/tekpi-eink
cd ~/tekpi-eink/pi
cp cadre.env.example cadre.env   # puis renseigner CADRE_TOKEN
./install.sh
```

Le SPI et l'I2C doivent être activés (`sudo raspi-config` › Interface Options).

Mettre à jour : `cd ~/tekpi-eink && git pull && pi/install.sh`.

### Au quotidien

| | |
|---|---|
| Afficher le titre suivant tout de suite | `sudo systemctl start cadre` |
| Voir ce qui s'est passé | `journalctl -u cadre -u cadre-sync -n 30` |
| Prochains déclenchements | `systemctl list-timers 'cadre*'` |
| Tester une mise en page sans toucher l'écran | `python3 cadre.py --preview` puis ouvrir `preview.png` |

`state.json` retient les titres déjà affichés et la dernière demande traitée. Le supprimer fait repartir du titre le plus récent.

## Déployer la page

Le projet Vercel `tekpi-eink` est relié à ce dépôt : chaque push sur `main` déploie.

| Variable | Rôle |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Accès au store Blob, posée par Vercel quand le store est relié au projet |
| `SITE_PASSWORD` | Mot de passe de la page. Sans elle, la page est ouverte à tous |
| `DEVICE_TOKEN` | Jeton du Pi, identique à `CADRE_TOKEN` dans `pi/cadre.env`. Sans lui, `/api/pi` est ouverte |

Sur le téléphone, « Ajouter à l'écran d'accueil » donne une petite app.

En local : `npm install && npm run dev` (avec un `.env.local`, voir `.env.example`).

## Choix de rendu

- **Texte sans anticrénelage.** Les pixels gris du lissage tomberaient sur la couleur la plus proche,
  souvent le bleu : chaque lettre aurait un liseré. Le texte est rendu net, en encres pures.
- **Seule la pochette est tramée** (Floyd-Steinberg), vers les couleurs *réellement* rendues par la dalle :
  le mélange à 50 % des palettes `SATURATED_PALETTE` et `DESATURATED_PALETTE` du pilote Pimoroni, comme le fait
  `set_image()` par défaut. L'image finale est envoyée en mode « P » à six couleurs exactes : le pilote ne retrame rien.
- **La couleur vient de la pochette** : l'encre de couleur qui en couvre au moins 12 % choisit le duotone du fond
  et de la carte. Le cartel reste noir sur blanc, seule la signature 320kbps.club est en rouge.
- **La carte** est rendue en SVG `crispEdges` puis rastérisée par sharp ; le Pi la ramène à la palette sans tramage.
- **L'aperçu** (`preview.png`) utilise les couleurs de l'encre : son fond grisâtre est celui de l'écran réel.

### Zone visible

Le passe-partout cache une partie de la dalle. Mesurée avec une mire : x 52 → 748, y 35 → 480.
Toute la mise en page tient dans `VISIBLE` (en haut de `cadre.py`), avec 24 px de marge en plus.
Si le Pi bouge dans le cadre, c'est la seule valeur à changer.

## Sources

- Flux : `https://www.320kbps.club/feed.xml` (titres, albums, pochettes en `media:content`)
- Pages d'album de 320kbps.club : année, style
- Contours : [Natural Earth](https://www.naturalearthdata.com) 1:50m, domaine public
- Villes : [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap), une requête par lieu, mise en cache
- Origine des artistes d'album : [MusicBrainz](https://musicbrainz.org), lieu de naissance ou de formation
