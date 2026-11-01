---
id: EPIC-024
titre: Relations entre personnages, questionnaire relié aux rôles et relations refusées
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-11-01
---

# EPIC-024 : Relations entre personnages, questionnaire relié aux rôles et relations refusées

## Objectif

Lot 5 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R8, R26) : préparer l'assistant de casting (lot 6). Les personnages se relient entre eux, les réponses au questionnaire désignent des rôles, et « les relations que je ne veux pas jouer » devient lisible par l'outil.

## Décisions

- Une relation relie deux personnages du jeu. Elle a un type (romance, famille, rivalité, alliance, hiérarchie, autre) et une description commune. Chaque côté peut avoir son libellé (« supérieure de », « subordonné de »).
- Chaque côté a sa case « visible du joueur ». Cochée, la relation entre dans une section « Relations » de la fiche personnage envoyée à ce joueur.
- On peut relier aux personnages, factions et intrigues chaque option d'une question à choix, ainsi qu'une question sur une échelle de 1 à 5 (plus la note est haute, plus le lien compte).
- « Les relations que je ne veux pas jouer » propose des cases (romance, famille, rivalité, alliance, hiérarchie) et garde le texte libre. Une case « Aucune, tout me va » répond à la question quand elle est obligatoire.

## US

| US | Titre | Statut |
|---|---|---|
| [US-097](US-097-relations-entre-personnages.md) | Relier les personnages entre eux | terminée |
| [US-098](US-098-questionnaire-relie-aux-roles.md) | Relier les réponses du questionnaire aux personnages, factions et intrigues | terminée |
| [US-099](US-099-relations-refusees.md) | Cocher les relations que l'on ne veut pas jouer | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0050](../../../adr/ADR-0050-relations-et-questionnaire-relie.md).
