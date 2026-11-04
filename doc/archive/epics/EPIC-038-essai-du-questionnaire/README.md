---
id: EPIC-038
titre: Aide à la conception du questionnaire, lot 1 : essai par l'équipe
statut: terminé
spec: ../../../specs/SPEC-016-conception-du-questionnaire.md
date: 2026-11-03
---

# EPIC-038 : Aide à la conception du questionnaire, lot 1 : essai par l'équipe

## Objectif

Lot 1 de [SPEC-016](../../../specs/SPEC-016-conception-du-questionnaire.md) (R1 à R3). Dans l'éditeur du formulaire, l'équipe répond au questionnaire comme un joueur et voit aussitôt quels personnages ressortent, et pourquoi, sans rien enregistrer.

Il passe après [EPIC-037](../EPIC-037-qualite-du-questionnaire-liens/README.md), dont US-135 étend la route pour qu'elle rende aussi les personnages PJ.

## US

| US | Titre | Statut |
|---|---|---|
| [US-135](US-135-essayer-le-questionnaire.md) | Essayer le questionnaire comme un joueur | terminée |

## Décisions

2026-11-03, choix de l'utilisatrice : voir l'historique de SPEC-016. Calculs et données : [ADR-0062](../../../adr/ADR-0062-aide-a-la-conception-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-04 : déployé (PR #133). La revue a corrigé le nom des factions et des intrigues dans le détail d'une note, et la fenêtre reprend les personnages lus par l'encadré au lieu de relire sa route. Le mélange des options de R1 viendra avec R13, au lot 3 de SPEC-016. Les lots 2 et 3 de SPEC-016 restent à faire.
- Epic archivé.
