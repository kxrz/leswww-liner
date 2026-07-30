# Guide d'installation

Pas à pas, du carton au cadre qui tourne seul. Pour la référence des variables
d'environnement, voir [DEPLOIEMENT.md](DEPLOIEMENT.md) ; ce document-ci est la
marche à suivre.

**Matériel visé** : Pimoroni Inky Impression 7.3" **2025 Edition** (PIM773,
dalle Spectra 6, 800 × 480, six couleurs sans orange) sur Raspberry Pi Zero 2 W.
L'ancienne révision ACeP 7 couleurs (PIM673) fonctionne aussi : la dalle est
détectée automatiquement, rien à changer.

Compter une heure la première fois, dont beaucoup d'attente pendant les
téléchargements.

---

## 1. Le site, d'abord

Le Pi ne sert à rien sans serveur : il ne fait que demander quoi afficher.

1. **Déployer sur Vercel.** Importer le dépôt, preset Next.js, aucune commande
   de build à préciser.
2. **Créer le stockage.** Dashboard → Storage → Blob → Create. Vercel pose
   `BLOB_READ_WRITE_TOKEN` tout seul dans la plupart des cas ; vérifier dans
   Settings → Environment Variables.
3. **Redéployer** pour que la variable soit lue.
4. **Ouvrir le site.** Il fonctionne, ouvert, avec un bandeau qui prévient que
   n'importe qui connaissant l'adresse peut y poster. On le fermera à
   l'étape 5, une fois la chaîne vérifiée.

Envoyer une photo, la cadrer, et regarder l'aperçu du rendu e-ink : c'est le
premier test utile. Si l'aperçu paraît juste, la moitié serveur est bonne.

---

## 2. Préparer le Raspberry Pi

### Assemblage

Pi éteint et débranché. La nappe de l'Inky se connecte sur le connecteur 40
broches, l'écran vers l'extérieur. Le HAT tient sur les entretoises fournies.

### Système

Raspberry Pi OS Lite (64 bits) suffit : il n'y a pas d'interface graphique à
faire tourner. Au flashage avec Raspberry Pi Imager, préconfigurer le Wi-Fi,
le nom d'hôte et SSH pour éviter d'avoir à brancher un clavier.

Puis en SSH :

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y python3-pip python3-pil python3-numpy
```

### Activer les bus

L'Inky communique en SPI, et lit son type sur un EEPROM en I²C — ce second
point est ce qui permet la détection automatique de la dalle.

```bash
sudo raspi-config
```

Interface Options → **SPI** → Enable, puis Interface Options → **I2C** →
Enable. Redémarrer.

### La bibliothèque Pimoroni

```bash
pip install --break-system-packages "inky[rpi]" requests
```

`--break-system-packages` est nécessaire sur Raspberry Pi OS récent, qui
protège les paquets système. Si tu préfères un environnement virtuel, il faudra
adapter le chemin de l'interpréteur dans le cron plus bas.

### Vérifier la dalle détectée

```bash
python3 -c "from inky.auto import auto; d = auto(); print(type(d).__name__, d.resolution)"
```

Attendu sur le 2025 Edition : `InkyE673 (800, 480)`. Sur l'ancienne révision :
un nom contenant `AC073`. Si la commande échoue, c'est presque toujours SPI ou
I²C non activés, ou la nappe mal enfoncée.

---

## 3. Installer le script

```bash
# Depuis ta machine
scp pi/update_display.py pi@raspberrypi.local:/home/pi/
```

Éditer les deux constantes en tête de fichier :

```python
BASE_URL = "https://ton-projet.vercel.app"   # sans slash final
DEVICE_TOKEN = ""                            # à remplir à l'étape 5
```

Essai à blanc, écran compris :

```bash
python3 /home/pi/update_display.py
cat ~/tekpi.log
```

Le premier lancement doit afficher quelque chose sur la dalle, ou expliquer
pourquoi dans le journal. Un cycle prend une vingtaine de secondes pendant
lesquelles l'écran clignote : c'est normal sur cette technologie.

### Le cron

```bash
crontab -e
```

```cron
* * * * * /usr/bin/python3 /home/pi/update_display.py
```

**Toutes les minutes, et pourtant le Pi n'interroge pas le serveur à cette
fréquence.** Le cron ne fait que réveiller le script ; celui-ci s'arrête
aussitôt si le délai fixé côté site n'est pas écoulé. La cadence réelle se
règle depuis **Réglages → Le Pi vérifie** (par défaut toutes les 5 minutes),
sans jamais toucher au crontab.

---

## 4. Vérifier que la boucle tourne

Sur le site, onglet **Écran**, en moins de dix minutes :

- pastille verte et « Pi connecté » ;
- **Dalle détectée** : `Inky Impression 7.3" Spectra 6 (6 couleurs)` ;
- **Driver** : `InkyE673` ;
- le **Journal**, déplié, montre les premières lignes remontées par le Pi.

Si la dalle affichée ne correspond pas à ce que le Pi a détecté, un bandeau
propose de recalculer les images : les couleurs auraient été calculées pour la
mauvaise palette.

Test de bout en bout : cliquer **Afficher maintenant** et chronométrer. L'écran
doit changer dans le délai de la cadence choisie.

---

## 5. Fermer les portes

Maintenant que la chaîne fonctionne, on la protège. Sur Vercel, Settings →
Environment Variables :

| Variable | Valeur |
|---|---|
| `SITE_PASSWORD` | ce que tu veux retenir |
| `DEVICE_TOKEN` | `openssl rand -hex 24` |

Redéployer, puis recopier **exactement** le jeton dans `DEVICE_TOKEN` en tête
du script du Pi. Les deux valeurs doivent correspondre : si tu ne la poses que
sur Vercel, le cadre se figera sur sa dernière image et l'onglet Écran montrera
le Pi comme injoignable.

Le bandeau d'avertissement disparaît, et un lien « Se déconnecter » apparaît en
pied de page.

---

## 6. Facultatif : l'album du jour

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md#2-spotify--seulement-pour-le-mode-album-du-jour)
pour le détail. En résumé : créer une application sur le dashboard Spotify,
poser `SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET`, puis coller dans les
réglages le lien d'une playlist **publique que tu as créée** — les playlists
éditoriales de Spotify sont fermées aux applications récentes.

Ajouter aussi `CRON_SECRET` (`openssl rand -hex 32`) pour que seul le cron de
Vercel puisse déclencher le calcul quotidien.

---

## 7. Ménager la dalle

Une dalle e-ink couleur supporte un nombre fini de cycles, et un cycle complet
dure 20 à 35 secondes pendant lesquelles l'écran clignote. Pimoroni donne comme
norme raisonnable un rafraîchissement complet toutes les quinze minutes au
plus. Trois garde-fous, tous réglables depuis le site :

| Réglage | Par défaut | Rôle |
|---|---|---|
| Intervalle de rotation | 4 h | À quelle fréquence l'image change |
| Délai minimal entre rafraîchissements | 15 min | Empêche deux cycles rapprochés |
| Cadence de sondage | 5 min | Latence entre un clic et l'écran |

L'onglet Écran affiche le **nombre de cycles cumulés** et la moyenne
quotidienne. Avec une rotation toutes les 4 heures, on est à six cycles par
jour, soit environ 2 200 par an : très loin de ce que la dalle encaisse. Le
risque réel n'est pas l'usage normal mais l'accident, par exemple une boucle de
réglages qui déclencherait des dizaines de cycles d'affilée. C'est ce que le
délai de garde empêche.

Un sondage sans changement n'allume pas la dalle : augmenter la cadence de
vérification ne l'use pas, ça ne coûte que quelques centaines d'octets.

---

## 8. Diagnostic

Le **Journal** de l'onglet Écran est le premier endroit à regarder : il
rassemble ce que le Pi et le serveur ont fait, sans passer par SSH.

| Symptôme | Cause probable | Remède |
|---|---|---|
| « Pi injoignable » | Cron absent, Wi-Fi, ou jeton posé d'un seul côté | `cat ~/tekpi.log` sur le Pi |
| `inky.auto()` échoue | SPI ou I²C désactivés, nappe mal mise | `raspi-config`, revérifier l'assemblage |
| Écran figé | Délai de garde en cours | « Afficher maintenant », qui passe outre |
| Couleurs fausses | Images calculées pour l'autre dalle | Bouton « Recalculer » du bandeau |
| Rien ne s'affiche jamais | Aucune image cadrée | Cadrer au moins une image |
| Changement lent à venir | Cadence de sondage élevée | Réglages → Le Pi vérifie |
| Album resté sur la veille | Le cron quotidien n'est pas passé | « Recalculer l'album » |

Sur le Pi, les deux fichiers utiles :

```bash
cat ~/tekpi.log            # journal local, le même que sur le site
cat ~/.tekpi-state.json    # révision affichée, dalle, cadence reçue
```

Forcer un cycle immédiat en ignorant la cadence :

```bash
rm ~/.tekpi-state.json && python3 /home/pi/update_display.py
```
