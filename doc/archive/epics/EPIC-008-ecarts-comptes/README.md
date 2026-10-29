---
id: EPIC-008
titre: Corriger les écarts de sécurité des comptes
statut: terminé
spec: ../../../specs/SPEC-008-comptes-et-partage.md
date: 2026-10-29
---

# EPIC-008 : Corriger les écarts de sécurité des comptes

## Objectif

Corriger les écarts 5 (jeton d'invitation en clair) et 6 (dernière administratrice) de [SPEC-008](../../../specs/SPEC-008-comptes-et-partage.md). Les écarts 1 à 4 sont réécrits par la refonte des comptes ([feuille de route](../../../feuille-de-route.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-042](US-042-jeton-d-invitation-hache.md) | Le jeton d'une invitation est gardé haché | terminée |
| [US-043](US-043-jamais-sans-administratrice.md) | Limbus garde toujours une administratrice | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-008 à jour.
- [ADR-0034](../../../adr/ADR-0034-jeton-d-invitation-hache.md).
