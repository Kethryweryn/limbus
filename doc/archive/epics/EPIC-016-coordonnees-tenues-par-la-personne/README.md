---
id: EPIC-016
titre: Coordonnées et allergies tenues par la personne
statut: terminé
spec: ../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-016 : Coordonnées et allergies tenues par la personne

## Objectif

Lot 5 de [SPEC-011](../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R12) : dès qu'une personne a un compte, elle seule modifie ses coordonnées (nom, téléphone, contact d'urgence, régime et allergies) ; chaque équipe les lit pour ses jeux. Termine l'écart 1 de [SPEC-007](../../../specs/SPEC-007-participants-et-rgpd.md).

## Décisions

- Une seule version des coordonnées, dans « Mon compte », valable pour toutes les équipes.
- Sur une fiche rattachée, l'équipe ne modifie plus que l'email, pour corriger un rattachement par erreur : changer l'email détache la fiche.
- Une mise à jour des allergies ne prévient pas les équipes : la fiche allergies se recalcule à la demande.

## US

| US | Titre | Statut |
|---|---|---|
| [US-074](US-074-mes-coordonnees.md) | Tenir ses coordonnées et ses allergies dans son compte | terminée |
| [US-075](US-075-fiche-tenue-par-la-personne.md) | La fiche d'une personne qui a un compte n'est plus modifiable par l'équipe | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0042](../../../adr/ADR-0042-coordonnees-du-compte.md).
