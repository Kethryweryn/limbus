---
id: EPIC-006
titre: Corriger les écarts des envois et des paiements
statut: en cours
spec: ../../specs/SPEC-006-emails-et-paiements.md
date: 2026-10-29
---

# EPIC-006 : Corriger les écarts des envois et des paiements

## Objectif

Aligner le code sur [SPEC-006](../../specs/SPEC-006-emails-et-paiements.md) : corriger ses trois écarts (renvoi, échecs d'envoi, montant), avec les choix faits par l'utilisatrice le 29 octobre 2026.

## US

| US | Titre | Statut |
|---|---|---|
| [US-029](US-029-echecs-d-envoi-non-bloquants.md) | Un échec d'envoi n'arrête pas les autres | terminée |
| [US-030](US-030-renvoyer-la-version-a-jour.md) | Renvoyer la version à jour d'un document, d'une fiche ou d'un trombinoscope | terminée |
| [US-031](US-031-tarifs-d-une-session.md) | Tarifs d'une session, attribués selon le rôle | terminée |
| [US-032](US-032-versements-et-etat-calcule.md) | Noter les versements, état de paiement calculé | terminée |
| [US-033](US-033-places-solidaires.md) | Places solidaires : soutien et réductions | terminée |
| [US-034](US-034-demandes-et-relances-avec-montants.md) | Demandes et relances avec le montant et le reste dû | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-006 à jour : les écarts corrigés sortent de la liste, les règles décrivent le nouveau comportement.
- [ADR-0031](../../adr/ADR-0031-version-d-un-envoi.md) et [ADR-0032](../../adr/ADR-0032-tarifs-et-versements.md).
