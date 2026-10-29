---
id: EPIC-004
titre: Corriger les écarts des sessions
statut: terminé
spec: ../../../specs/SPEC-004-sessions.md
date: 2026-10-29
---

# EPIC-004 : Corriger les écarts des sessions

## Objectif

Aligner le code sur [SPEC-004](../../../specs/SPEC-004-sessions.md) : corriger ses quatre écarts, dont le cycle de vie d'une session décrit par la fiche [Cycle de vie d'une session](../../todo/cycle-de-vie-d-une-session.md), avec les choix faits par l'utilisatrice le 29 octobre 2026.

## US

| US | Titre | Statut |
|---|---|---|
| [US-017](US-017-un-seul-pj-par-participant.md) | Un seul PJ par participant, réglable par jeu | terminée |
| [US-018](US-018-modifications-simultanees-d-une-session.md) | Modifications simultanées d’une session | terminée |
| [US-019](US-019-session-visible-sur-la-page-publique.md) | Choisir si une session est visible sur la page publique | terminée |
| [US-020](US-020-statuts-d-une-session.md) | Statuts réversibles et session terminée hors des listes courantes | terminée |
| [US-021](US-021-supprimer-oriente-vers-l-annulation.md) | Supprimer une session oriente vers l’annulation ou le report | terminée |
| [US-022](US-022-reporter-une-session.md) | Reporter une session | terminée |
| [US-023](US-023-suivre-les-remboursements.md) | Suivre les remboursements d’une session annulée ou reportée | terminée |
| [US-024](US-024-confirmer-sa-presence.md) | Confirmer sa présence à une session reportée | terminée |
| [US-025](US-025-prevenir-de-l-annulation.md) | Prévenir l’équipe de l’annulation d’une session | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-004 à jour : les écarts corrigés sortent de la liste, les règles décrivent le nouveau comportement ; la fiche Cycle de vie part dans `archive/todo/`.
- [ADR-0028](../../../adr/ADR-0028-version-d-une-session.md) et [ADR-0029](../../../adr/ADR-0029-cycle-de-vie-d-une-session.md).
