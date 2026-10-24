# CLAUDE.md

Lire `README.md` d'abord : architecture, installation, choix de rendu.

## À respecter

- **La mise en page se fait sur le Pi** (`pi/cadre.py`, Pillow). Le site transmet les demandes et rend seulement la carte (`/api/map`).
- **Rester simple.** Un seul script Python côté Pi ; côté web une page, deux routes (synchro, carte), deux fichiers JSON dans Blob.
  Pas de base de données, pas de framework CSS, pas de dépendance qui ne serait pas indispensable.
- **Texte jamais lissé ni tramé** (`d.fontmode = "1"`), encres pures uniquement. Seule la pochette est tramée.
- **Dalle Spectra 6** : noir, blanc, jaune, rouge, bleu, vert. Pas d'orange.
- **Zone visible** : rien en dehors de `VISIBLE` (le passe-partout masque les bords).
- Le Pi vit dans `/home/pi/tekpi-eink` (clone de ce dépôt) ; `pi/cadre.env` et `pi/state.json` ne sont pas versionnés.
- Avant d'afficher une nouvelle mise en page, la vérifier avec `python3 cadre.py --preview` : un rafraîchissement
  coûte 30 secondes et un cycle de dalle.

## Accès au Pi

`ssh pi@raspberrypi.local` (clé SSH), sudo sans mot de passe.
