---
id: EPIC-007
titre: Corriger les écarts des participants
statut: en cours
spec: ../../specs/SPEC-007-participants-et-rgpd.md
date: 2026-10-29
---

# EPIC-007 : Corriger les écarts des participants

## Objectif

Aligner le code sur [SPEC-007](../../specs/SPEC-007-participants-et-rgpd.md) : corriger ses écarts 2 (retrait d'un jeu), 4 (export) et 5 (`published`), avec les choix faits par l'utilisatrice le 29 octobre 2026. Le retrait d'un jeu a fait apparaître le cas du désistement tardif et du remplaçant, qui touche les paiements ([SPEC-006](../../specs/SPEC-006-emails-et-paiements.md)) : US-039 à US-041.

Les écarts 1 (fiche commune) et 3 (durée de conservation) sont traités par la refonte des comptes et la fiche Photos et RGPD ([feuille de route](../../feuille-de-route.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-035](US-035-retrait-d-un-jeu-et-de-ses-sessions.md) | Retirer une personne d'un jeu la retire de ses sessions | terminée |
| [US-036](US-036-une-fiche-a-toujours-un-jeu.md) | Une fiche a toujours au moins un jeu | terminée |
| [US-037](US-037-export-complet-des-inscriptions.md) | Export complet des inscriptions | terminée |
| [US-038](US-038-retirer-participant-published.md) | Retirer `Participant.published` | terminée |
| [US-039](US-039-paiement-d-une-personne-qui-part.md) | Paiement d'une personne qui part : rembourser, garder ou transférer | terminée |
| [US-040](US-040-date-limite-de-desistement.md) | Date limite de désistement | terminée |
| [US-041](US-041-place-offerte.md) | Place offerte | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-007 et SPEC-006 à jour.
- [ADR-0033](../../adr/ADR-0033-paiement-d-une-personne-qui-part.md).
