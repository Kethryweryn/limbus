---
id: EPIC-041
titre: Aide à la conception du questionnaire, lot 2 : prévision
statut: terminé
spec: ../../../specs/SPEC-016-conception-du-questionnaire.md
date: 2026-11-04
---

# EPIC-041 : Aide à la conception du questionnaire, lot 2 : prévision

## Objectif

Lot 2 de [SPEC-016](../../../specs/SPEC-016-conception-du-questionnaire.md) (R4 à R10). Avant toute réponse, l'équipe sait si son questionnaire peut départager les personnages et ce que donnerait une inscription typique, selon les proportions qu'elle attend pour les options.

Il passe après [EPIC-040](../EPIC-040-qualite-du-questionnaire-estimation/README.md), dont il applique les seuils, et [EPIC-039](../EPIC-039-qualite-du-questionnaire-reponses/README.md), dont il réutilise les calculs.

## US

| US | Titre | Statut |
|---|---|---|
| [US-141](US-141-proportions-attendues.md) | Indiquer les proportions attendues des options | terminée |
| [US-142](US-142-information-maximale.md) | Savoir si les questions peuvent départager les personnages | terminée |
| [US-143](US-143-simulation-de-repondants.md) | Voir ce que donnerait une inscription typique | terminée |

## Décisions

2026-11-04, choix de l'utilisatrice : voir l'historique de SPEC-016. Calculs et données : [ADR-0062](../../../adr/ADR-0062-aide-a-la-conception-du-questionnaire.md) ; seuils : [ADR-0064](../../../adr/ADR-0064-estimation-generale-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-05 : déployé (PR #135). La revue a notamment couvert une liste de proportions vidée par le contrôle de version (`assertRowsVersion`), compté une seule fois deux options de même texte, et distingué un conflit sur les proportions d'un échec de tout l'enregistrement. Le lot 3 de SPEC-016 reste à faire.
- Epic archivé.
