---
id: EPIC-012
titre: Rôles : un seul rôle global, quitter et transférer un jeu
statut: en cours
spec: ../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-012 : Rôles : un seul rôle global, quitter et transférer un jeu

## Objectif

Lot 1 de [SPEC-011](../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) : le seul rôle global est administrateur ; les droits viennent des jeux. Corrige aussi les écarts 3 (quitter un jeu) et 4 (transférer un jeu) de [SPEC-008](../../specs/SPEC-008-comptes-et-partage.md).

## US

| US | Titre | Statut |
|---|---|---|
| [US-058](US-058-un-seul-role-global.md) | Un seul rôle global : administrateur ou non | terminée |
| [US-059](US-059-quitter-un-jeu.md) | Quitter un jeu partagé | à faire |
| [US-060](US-060-transferer-un-jeu.md) | Transférer un jeu à une co-organisatrice | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- CLAUDE.md : `requireUser` remplace `requireOrganizer`.
- [ADR-0038](../../adr/ADR-0038-un-seul-role-global.md).
