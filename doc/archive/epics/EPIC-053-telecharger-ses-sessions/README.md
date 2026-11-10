---
id: EPIC-053
titre: Télécharger ses sessions à venir
statut: terminé
spec: ../../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-10
---

# EPIC-053 : Télécharger ses sessions à venir

## Objectif

Une participante télécharge ses participations et les documents reçus pour ses sessions à venir, pour les relire sans réseau (SPEC-019, R16).

## US

| US | Titre | Statut |
|---|---|---|
| [US-229](US-229-telecharger-mes-sessions.md) | Télécharger mes sessions à venir | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises ; tests de bout en bout sur les quatre axes (ADR-0079).
- Une note dans `nouveautes/` pour chaque PR.

## Suivi

- 2026-11-10 : déployé en une PR (#208), vérifiée en production (sites joignables, note dans /nouveautes).
- La revue a corrigé une copie « en attente » qu'une mise à jour pouvait effacer, et une lecture des participations faite pour tout compte.
- En route, le téléchargement d'un jeu efface lui aussi ce que le précédent gardait et que le nouveau ne garde plus.
- Epic archivé ; SPEC-019 implémentée.
