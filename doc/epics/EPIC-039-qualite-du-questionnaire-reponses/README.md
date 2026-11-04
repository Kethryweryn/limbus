---
id: EPIC-039
titre: Qualité du questionnaire, lot 2 : repères sur les réponses
statut: à faire
spec: ../../specs/SPEC-015-qualite-du-questionnaire.md
date: 2026-11-04
---

# EPIC-039 : Qualité du questionnaire, lot 2 : repères sur les réponses

## Objectif

Lot 2 de [SPEC-015](../../specs/SPEC-015-qualite-du-questionnaire.md) (R7 à R12). Une fois des réponses reçues, l'encadré « Qualité du questionnaire » dit quelles questions ne départagent pas ou font doublon, quels personnages restent indistincts chez les inscrits, et lesquels sont peu ou trop demandés.

## US

| US | Titre | Statut |
|---|---|---|
| [US-136](US-136-questions-qui-ne-departagent-pas.md) | Les questions qui ne départagent pas et les échelles tassées | à faire |
| [US-137](US-137-questions-qui-font-doublon.md) | Les questions qui font doublon | à faire |
| [US-138](US-138-personnages-indistincts-chez-les-inscrits.md) | Les personnages indistincts chez les inscrits | à faire |
| [US-139](US-139-personnages-peu-ou-trop-demandes.md) | Les personnages peu ou trop demandés | à faire |

## Décisions

2026-11-04, choix de l'utilisatrice : voir l'historique de SPEC-015. Indicateurs et seuils : [ADR-0061](../../adr/ADR-0061-indicateurs-du-questionnaire.md), [ADR-0063](../../adr/ADR-0063-reperes-sur-les-reponses.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
