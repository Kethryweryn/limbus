---
id: EPIC-047
titre: Demande de disponibilités au vivier
statut: terminé
spec: ../../../specs/SPEC-018-vivier-permanent.md
date: 2026-11-06
---

# EPIC-047 : Demande de disponibilités au vivier

## Objectif

Quand une session s'ouvre, l'équipe écrit au vivier pour demander qui est intéressé et disponible. Chacun répond d'un clic, retrouve ses réponses, et voit la dernière version du questionnaire.

## US

| US | Titre | Statut |
|---|---|---|
| [US-166](US-166-demander-au-vivier.md) | Demander au vivier qui est disponible | terminée |
| [US-167](US-167-repondre-a-la-demande.md) | Répondre à une demande d'un clic | terminée |
| [US-168](US-168-relancer-la-demande.md) | Relancer les personnes sans réponse | terminée |
| [US-169](US-169-liens-et-derniere-version.md) | Revenir sur mes réponses avec un lien qui reste valable | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
- Les jeux de test (`prisma/seed/`) et `doc/jeux-de-test.md` couvrent ce que le lot ajoute, dans la même PR.

## Suivi

- 2026-11-06 : déployé en une PR (#161), vérifiée en production (sites joignables).
- Epic archivé.
