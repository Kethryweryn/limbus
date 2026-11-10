---
id: EPIC-052
titre: Télécharger un jeu pour le hors ligne
statut: en cours
spec: ../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-10
---

# EPIC-052 : Télécharger un jeu pour le hors ligne

## Objectif

Une organisatrice ou co-organisatrice télécharge un de ses jeux actifs, tout entier, pour le consulter sans réseau ; il se remet à jour tout seul, et part de l'appareil si elle en perd l'accès (SPEC-019, R8 à R15).

## US

| US | Titre | Statut |
|---|---|---|
| [US-226](US-226-telecharger-un-jeu.md) | Télécharger un jeu pour le consulter sans réseau | terminée |
| [US-227](US-227-mise-a-jour-du-jeu-telecharge.md) | Garder à jour un jeu téléchargé | à faire |
| [US-228](US-228-acces-perdu-jeu-efface.md) | Effacer de l’appareil un jeu dont l’accès est perdu | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises ; tests de bout en bout sur les quatre axes (ADR-0079).
- Une note dans `nouveautes/` pour chaque PR.
