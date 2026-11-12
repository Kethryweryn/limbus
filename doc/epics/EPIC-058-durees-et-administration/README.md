---
id: EPIC-058
titre: Comptes non activés : durée et administration
statut: en cours
spec: ../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-12
---

# EPIC-058 : Comptes non activés : durée et administration

## Objectif

Lot 3 de [SPEC-022](../../specs/SPEC-022-compte-pour-chaque-participant.md) :

- un compte jamais activé est effacé avec sa dernière fiche ([ADR-0090](../../adr/ADR-0090-effacement-du-compte-non-active.md)) ;
- l'administration montre les comptes non activés à part, en lecture seule.

La politique de confidentialité (R16) a été avancée au lot 2 (US-244).

## US

| US | Titre | Statut |
|---|---|---|
| [US-248](US-248-comptes-non-actives-dans-l-administration.md) | Les comptes non activés dans l'administration | à faire |
| [US-249](US-249-effacement-du-compte-non-active.md) | Effacer un compte non activé avec sa dernière fiche | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
