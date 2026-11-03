---
id: EPIC-037
titre: Qualité du questionnaire, lot 1 : repères sur les liens
statut: terminé
spec: ../../../specs/SPEC-015-qualite-du-questionnaire.md
date: 2026-11-03
---

# EPIC-037 : Qualité du questionnaire, lot 1 : repères sur les liens

## Objectif

Lot 1 de [SPEC-015](../../../specs/SPEC-015-qualite-du-questionnaire.md) (R1 à R6). Avant même la première inscription, l'équipe voit dans l'éditeur du formulaire si ses liens entre réponses et rôles permettent de choisir : personnages qu'aucune réponse ne rejoint, questions et options sans lien, personnages que les liens ne distinguent pas. Chaque repère dit quoi corriger.

## US

| US | Titre | Statut |
|---|---|---|
| [US-133](US-133-encadre-et-liens-manquants.md) | L'encadré « Qualité du questionnaire » et les liens manquants | terminée |
| [US-134](US-134-personnages-indistincts-par-les-liens.md) | Les personnages que les liens ne distinguent pas | terminée |

## Décisions

2026-11-03, choix de l'utilisatrice : voir l'historique de SPEC-015. Indicateurs et seuils : [ADR-0061](../../../adr/ADR-0061-indicateurs-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-03 : déployé (PR #127). La revue a corrigé une lecture périmée quand deux relectures de l'encadré se croisent, et des repères masqués tant que le jeu n'a pas de personnage PJ. Les lots 2 et 3 de SPEC-015 restent à faire.
- Epic archivé.
