---
id: EPIC-017
titre: Export et effacement depuis le compte
statut: terminé
spec: ../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-017 : Export et effacement depuis le compte

## Objectif

Lot 6 de [SPEC-011](../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R13) : la personne télécharge toutes ses données et efface son compte elle-même, immédiatement ; chaque équipe concernée est prévenue.

## Décisions

- L'effacement du compte efface aussi toutes ses fiches participant, chez toutes les équipes (inscriptions, photos, paiements, notes).
- Il est refusé tant que la personne possède des jeux : elle les transfère ou les supprime d'abord.

## US

| US | Titre | Statut |
|---|---|---|
| [US-076](US-076-telecharger-ses-donnees.md) | Télécharger toutes ses données depuis son compte | terminée |
| [US-077](US-077-effacer-son-compte.md) | Effacer son compte, équipes prévenues | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0043](../../../adr/ADR-0043-effacement-du-compte.md).
