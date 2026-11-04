---
id: EPIC-040
titre: Qualité du questionnaire, lot 3 : estimation générale
statut: terminé
spec: ../../specs/SPEC-015-qualite-du-questionnaire.md
date: 2026-11-04
---

# EPIC-040 : Qualité du questionnaire, lot 3 : estimation générale

## Objectif

Lot 3 de [SPEC-015](../../specs/SPEC-015-qualite-du-questionnaire.md) (R13). Une fois des réponses reçues, l'encadré « Qualité du questionnaire » s'ouvre sur une estimation générale : ce que l'affectation optimale donne à chaque personne, et combien de personnes le questionnaire laisse à égalité entre plusieurs personnages.

## US

| US | Titre | Statut |
|---|---|---|
| [US-140](US-140-estimation-generale.md) | L'estimation générale du questionnaire | terminée |

## Décisions

2026-11-04, choix de l'utilisatrice : voir l'historique de SPEC-015. Seuils et calcul : [ADR-0064](../../adr/ADR-0064-estimation-generale-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
