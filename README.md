# tekpi-eink

Un cadre e-ink posé dans le salon : un titre de [320kbps.club](https://www.320kbps.club) et la météo de Lille,
renouvelés matin et soir, avec une petite page web pour changer de titre depuis le téléphone.

```
┌──────────────────────────────────────────────┐
│ samedi 24 octobre               320kbps.club │
│ ──────────────────────────────────────────── │
│ ┌────────┐  Bitter Better                    │
│ │pochette│  Magugu & Le Motel                │
│ │ tramée │                            ▣ QR   │
│ └────────┘  nouvel EP                        │
│ ──────────────────────────────────────────── │
│         Lille        8h   12h   16h   20h    │
│  11°    aujourd'hui  ☁    ☀    🌧    🌧     │
│         min 6°       6°   11°   10°   10°    │
└──────────────────────────────────────────────┘
```

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

Tout le dessin se fait **sur le Pi**, en Python avec Pillow. Le site ne fait que transmettre des demandes.

- **7h** : le prochain titre du flux pas encore affiché, et la météo du jour.
- **19h** : le titre suivant, et la météo du lendemain.
- **Depuis la page** : « Titre suivant », « Rafraîchir » (même titre, météo à jour) ou n'importe quel titre du flux.

Sans connexion à la page (pas de `cadre.env`), le cadre fonctionne seul, matin et soir.

## Le dépôt

```
app/                 page mobile (Next.js) et route /api/pi du Pi
lib/
  feed.ts            lecture du flux RSS de 320kbps.club
  store.ts           command.json et status.json dans Vercel Blob
  auth.ts            mot de passe de la page, jeton du Pi
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
| Version du soir | `python3 cadre.py --preview --soir` |

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
- **La couleur reste un accent** : rouge pour l'artiste, température bleue (< 12 °C) ou rouge (≥ 24 °C),
  pluie en bleu au-delà de 50 %, pictos météo dessinés au trait. Le reste est noir sur blanc, dans l'esprit Mudita.
- **L'aperçu** (`preview.png`) utilise les couleurs de l'encre : son fond grisâtre est celui de l'écran réel.

### Zone visible

Le passe-partout cache une partie de la dalle. Mesurée avec une mire : x 52 → 748, y 35 → 480.
Toute la mise en page tient dans `VISIBLE` (en haut de `cadre.py`), avec 24 px de marge en plus.
Si le Pi bouge dans le cadre, c'est la seule valeur à changer.

## Sources

- Flux : `https://www.320kbps.club/feed.xml` (titres, albums, pochettes en `media:content`)
- Météo : [Open-Meteo](https://open-meteo.com), sans clé ; Lille (50,63 ; 3,06), fuseau Europe/Paris
