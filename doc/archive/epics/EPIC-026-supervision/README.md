---
id: EPIC-026
titre: Supervision de la production
statut: terminé
spec: ../../../todo/supervision.md
date: 2026-11-01
---

# EPIC-026 : Supervision de la production

## Objectif

Étape 5 de la [feuille de route](../../../feuille-de-route.md), chantier 3 ([fiche](../../../todo/supervision.md), revue d'architecture R-15) : être prévenu par email quand Limbus, ou le site professionnel hébergé sur le même serveur, ne répond plus.

## Décisions

- Limbus expose une page de santé publique, qui vérifie que la base répond et donne la version déployée.
- Un service externe, Better Stack (offre gratuite), interroge cette page, ainsi que le site professionnel, et prévient par email. L'utilisatrice crée le compte et les sondes elle-même.
- Les journaux structurés (R-16) attendent que la supervision en montre le besoin.

## US

| US | Titre | Statut |
|---|---|---|
| [US-103](US-103-page-de-sante.md) | Page de santé de Limbus | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0052](../../../adr/ADR-0052-page-de-sante.md).
- Les sondes Better Stack sont créées par l'utilisatrice (hors code).
