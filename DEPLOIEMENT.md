# Déploiement et configuration

Quoi ajouter, où, et pourquoi. Le projet a deux moitiés qui ne se parlent que
par une URL : le site sur Vercel décide de tout, le Raspberry Pi vient demander
s'il y a quelque chose à afficher.

Rien n'est obligatoire à part le stockage. Chaque protection absente laisse le
projet fonctionner, en mode ouvert, et l'interface le signale plutôt que de le
masquer. C'est un choix : couper le cadre en silence à la première mise en
production serait pire que l'absence de protection.

---

## 1. Vercel — les variables d'environnement

À poser dans **Settings → Environment Variables**, puis redéployer (les
variables ne sont lues qu'au démarrage d'une fonction).

| Variable | Obligatoire | Sans elle |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | oui | Rien ne fonctionne : c'est le stockage. |
| `SITE_PASSWORD` | non | **Le site est public.** Un bandeau d'avertissement s'affiche. |
| `DEVICE_TOKEN` | non | Les trois routes du Pi restent ouvertes. |
| `SPOTIFY_CLIENT_ID` | mode album | Le mode « album du jour » échoue. |
| `SPOTIFY_CLIENT_SECRET` | mode album | Idem. |
| `CRON_SECRET` | non | Le cron quotidien reste appelable par n'importe qui. |

### `BLOB_READ_WRITE_TOKEN`

**Où le trouver** : Vercel Dashboard → Storage → créer un store Blob → Tokens.
Vercel le pose souvent tout seul lors de la création du store.

**Pourquoi** : tout est dans le Blob. Les images (`originals/`, `crops/`,
`display/`), la configuration (`config/settings.json`), l'état rapporté par le
Pi (`state/pi.json`), le cache de la playlist. Il n'y a pas de base de données,
et ce n'est pas un manque : le volume ne le justifie pas.

### `SITE_PASSWORD`

**Quoi** : le mot de passe d'entrée du site. N'importe quelle chaîne ; les
espaces de début et de fin sont ignorés, la casse compte.

**Pourquoi** : sans lui, `/api/upload`, `/api/save-config` et la galerie sont
accessibles à qui connaît l'adresse. N'importe qui peut poster une image sur ton
mur ou vider la bibliothèque.

**Effet** : `middleware.ts` redirige toute visite sans cookie vers `/login`. La
connexion pose un cookie `HttpOnly` valable 30 jours. Pour révoquer tout le
monde, change le mot de passe et redéploie : les anciens cookies ne valident
plus, puisque leur valeur est une empreinte du mot de passe.

### `DEVICE_TOKEN`

**Quoi** : une chaîne aléatoire, par exemple `openssl rand -hex 24`.

**Pourquoi** : le Pi n'a pas de navigateur et ne peut pas suivre une redirection
vers un formulaire de connexion. Il lui faut donc son propre moyen de s'annoncer
sur `/api/state`, `/api/next-image` et `/api/heartbeat`.

**Attention** : cette valeur doit être **recopiée à l'identique** dans
`pi/update_display.py` (voir la section 3). La poser d'un seul côté fige le
cadre sur sa dernière image. Sans casse : l'onglet Écran montrera simplement le
Pi comme injoignable.

### `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET`

Nécessaires seulement en mode « album du jour ». Voir la section 2.

### `CRON_SECRET`

**Quoi** : une chaîne aléatoire que **tu crées toi-même**
(`openssl rand -hex 32`). Contrairement à ce qu'on lit parfois, Vercel ne la
génère pas : tu la poses, et Vercel la renvoie ensuite en
`Authorization: Bearer …` sur ses appels de cron.

**Pourquoi** : `/api/album/refresh` recalcule l'image du jour et appelle
Spotify. Sans secret, n'importe qui peut la déclencher en boucle.

**Effet** : une fois définie, la route n'accepte plus que le cron signé ou une
session ouverte depuis le site (le bouton « Recalculer l'album »).

---

## 2. Spotify — seulement pour le mode « album du jour »

### Créer l'application

1. Aller sur [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. **Create app**. Le nom et la description sont libres.
3. **Redirect URI** : mettre `http://localhost:8888/callback`. Le champ est
   obligatoire mais jamais utilisé : on n'emploie pas de connexion utilisateur.
4. Cocher **Web API**.
5. Relever **Client ID** et **Client Secret** dans Settings.

Le flux employé est *Client Credentials* : l'application s'authentifie seule,
sans que personne ait à se connecter. C'est ce qui permet à un cron de tourner
sans surveillance.

### Choisir la playlist

**La playlist doit être publique et t'appartenir.** Depuis le 27 novembre 2024,
Spotify interdit aux applications créées après cette date de lire ses playlists
éditoriales et algorithmiques : « Découvertes de la semaine », « Today's Top
Hits » et consorts renvoient une erreur, quelles que soient tes permissions.
En février 2026, l'endpoint listant les playlists d'un utilisateur a lui aussi
disparu, d'où le choix d'épingler un identifiant plutôt que de proposer une
liste déroulante.

Pour la rendre publique : ouvrir la playlist dans Spotify, menu « … », puis
**Ajouter au profil** (l'intitulé varie selon les versions).

Ensuite, dans l'onglet **Réglages** du site : mode « Album du jour », et coller
le lien de partage. L'URL complète, l'URI `spotify:playlist:…` ou l'identifiant
nu fonctionnent indifféremment.

### Ce qui se passe ensuite

Le cron quotidien (`vercel.json`, à 1 h UTC, soit après minuit à Paris toute
l'année) relit la playlist, en met le catalogue en cache dans le Blob, choisit
l'album du jour et compose l'image. Si Spotify est injoignable, le cache prend
le relais et l'écran garde son album : un avertissement apparaît sur l'onglet
Écran, mais le cadre ne se vide pas.

Le plan hobby de Vercel n'autorise qu'une exécution de cron par jour, ce qui
tombe bien : c'est exactement le besoin. Le bouton « Recalculer l'album »
permet de forcer entre deux passages.

---

## 3. Le Raspberry Pi

### Installation

```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-pil python3-numpy
pip install --break-system-packages inky[rpi] requests
```

Activer SPI et I²C : `sudo raspi-config` → Interface Options.

### Le script

Copier `pi/update_display.py` dans `/home/pi/`, puis éditer les deux constantes
en tête de fichier :

```python
BASE_URL = "https://tekpi-eink.vercel.app"   # l'adresse de ton déploiement
DEVICE_TOKEN = ""                            # identique à celui posé sur Vercel
```

Laisser `DEVICE_TOKEN` vide si tu n'as pas protégé les routes du Pi.

### Le cron

```bash
crontab -e
```

```cron
* * * * * /usr/bin/python3 /home/pi/update_display.py
```

**Toutes les minutes, et ce n'est pas une erreur.** Un sondage sans changement
ne transfère que quelques centaines d'octets : le serveur répond « rien à
faire » et le script s'arrête sans allumer la dalle. C'est ce qui donne une
réactivité d'environ une minute entre un clic sur le site et l'écran qui bouge,
là où un cron Vercel serait limité à une fois par jour.

Le script mémorise la révision affichée dans `~/.tekpi-state.json` et
journalise ses erreurs dans `~/tekpi.log`.

---

## 4. Ordre de mise en route

1. Créer le store Blob et vérifier que `BLOB_READ_WRITE_TOKEN` est bien posé.
2. Déployer. Le site fonctionne, ouvert, avec le bandeau d'avertissement.
3. Copier le script sur le Pi, régler `BASE_URL`, installer le cron.
4. Attendre une minute : l'onglet Écran doit afficher « Pi connecté » et le
   modèle de dalle détecté.
5. Envoyer une image, la cadrer, vérifier l'aperçu du rendu e-ink.
6. Poser `SITE_PASSWORD` et `DEVICE_TOKEN` sur Vercel, redéployer, recopier le
   jeton dans le script du Pi.
7. Pour le mode album : `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `CRON_SECRET`, puis coller la playlist dans les réglages.

Faire les étapes 3 à 5 avant la 6 permet de vérifier que la chaîne fonctionne
avant d'y ajouter des jetons, ce qui évite de chercher une panne à deux endroits
à la fois.

---

## 5. Diagnostic

| Symptôme | Cause probable | Remède |
|---|---|---|
| « Pi injoignable » sur l'onglet Écran | Cron absent, réseau, ou `DEVICE_TOKEN` posé d'un seul côté | Voir `~/tekpi.log` sur le Pi |
| L'écran ne change jamais | Délai de garde, ou révision déjà à jour | Bouton « Afficher maintenant », qui passe outre |
| Bandeau « les images doivent être recalculées » | La dalle détectée diffère de celle utilisée au rendu, ou la saturation a changé | Bouton « Recalculer » du même bandeau |
| Couleurs fausses ou délavées | Images calculées pour l'autre dalle | Même bouton |
| « playlist introuvable » | Playlist privée, ou playlist éditoriale Spotify | Utiliser une playlist personnelle rendue publique |
| « authentification refusée » | Identifiants Spotify erronés, ou Web API non cochée | Vérifier les Settings de l'app Spotify |
| Album figé sur la veille | Le cron n'est pas passé | Bouton « Recalculer l'album » |
| Le site demande un mot de passe alors qu'il n'y en a pas | `SITE_PASSWORD` défini mais oublié | Le changer sur Vercel et redéployer |
| Le Pi reçoit du HTML au lieu d'une image | `DEVICE_TOKEN` absent côté Pi | Recopier le jeton dans le script |

---

## 6. Indexation

Le site n'a aucune raison d'apparaître dans un moteur de recherche. Trois
barrières, actives par défaut, rien à configurer :

| Barrière | Fichier | Ce qu'elle couvre |
|---|---|---|
| `robots.txt` | `app/robots.ts` | Le robot qui explore le site depuis la racine |
| En-tête `X-Robots-Tag` | `next.config.ts` | Le robot arrivé par un lien externe, sans passer par `robots.txt` |
| Balise `<meta name="robots">` | `app/layout.tsx` | Le robot qui lit la page sans regarder les en-têtes |

L'en-tête est posé sur **toutes** les réponses, y compris la redirection vers
`/login` : un moteur tombant sur une page protégée reçoit quand même la
consigne. Et `robots.txt` reste lisible sans mot de passe, sans quoi le moteur
serait redirigé vers le formulaire et ne lirait jamais la consigne.

Ces trois barrières sont des **consignes**, respectées par les robots honnêtes
et ignorées par les autres. La seule protection réelle reste `SITE_PASSWORD`.

---

## 7. Ce qui n'est volontairement pas fait

- **Pas de base de données.** Le Blob suffit largement au volume.
- **Pas de comptes utilisateurs.** Un mot de passe unique, partagé, convient à
  un objet posé dans un salon.
- **Pas de boutons physiques.** L'écran est dans un cadre photo : les boutons
  de la tranche sont inaccessibles.
