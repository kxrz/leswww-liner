#!/usr/bin/env bash
# Ignored Build Step de Vercel (vercel.json > ignoreCommand) : exit 0 = pas de build, exit 1 = build.
#
# Branches claude/* : pas de preview, sauf si le message du dernier commit contient [preview].
# Ces branches déclenchaient des dizaines de builds par jour, payés en minutes de build Vercel,
# souvent sans que personne ne regarde la preview. Toutes les autres branches (dont main et les
# deploy hooks) sont construites comme avant.
if [[ "$VERCEL_GIT_COMMIT_REF" == claude/* ]] && ! git log -1 --pretty=%B | grep -q '\[preview\]'; then
  echo "Preview ignorée pour $VERCEL_GIT_COMMIT_REF (ajouter [preview] au message de commit pour la construire)."
  exit 0
fi
exit 1
