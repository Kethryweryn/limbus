---
id: ADR-0037
titre: Un jeu commun pour les tests de bout en bout
statut: accepté
date: 2026-10-29
liens: [../todo/tests-e2e-des-parcours.md, ../epics/EPIC-011-tests-e2e-des-parcours/README.md]
---

# ADR-0037 : Un jeu commun pour les tests de bout en bout

## Contexte

Les tests de bout en bout des parcours (casting, trombinoscopes, envois, paiements, hors ligne) ont besoin d'un jeu avec des personnages, des participants et des sessions. Les créer par l'interface dans chaque test serait lent et répéterait le même parcours partout.

## Décision

- `tests/e2e/globalSetup.ts` prépare, directement en base, un jeu commun : personnages PJ et PNJ, participants avec email, lieu.
- Chaque test crée par l'interface ce qu'il vérifie (session, casting, tarif…) et prépare en base ce dont il a seulement besoin comme point de départ, sous un nom qui lui est propre. Un test ne modifie pas ce qu'un autre utilise.
- Les tests tournent l'un après l'autre (un seul worker), contre la base de test vidée au démarrage.
- Pas de plafond de durée : la durée de la CI est surveillée.

## Conséquences

- Ajouter un parcours coûte peu : le jeu commun est déjà là.
- Un test qui modifie le jeu commun (renommer un personnage…) fausserait les autres : ce qui doit changer est créé par le test.

## Options écartées

- **Un jeu par test** : indépendance totale, mais plus lent et plus long à écrire ; l'utilisatrice a choisi le jeu commun.
