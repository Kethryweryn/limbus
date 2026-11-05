---
id: EPIC-042
titre: Aide à la conception du questionnaire, lot 3 : relecture et mélange
statut: en cours
spec: ../../specs/SPEC-016-conception-du-questionnaire.md
date: 2026-11-05
---

# EPIC-042 : Aide à la conception du questionnaire, lot 3 : relecture et mélange

## Objectif

Dernier lot de [SPEC-016](../../specs/SPEC-016-conception-du-questionnaire.md) (R11 à R13, et le mélange dans l'essai, R1). L'équipe voit les questions à relire, peut demander une relecture plus large à son assistant d'IA, et mélange l'ordre des options là où il n'a pas de sens.

Il complète [EPIC-038](../../archive/epics/EPIC-038-essai-du-questionnaire/README.md) (essai) et [EPIC-041](../../archive/epics/EPIC-041-prevision-du-questionnaire/README.md) (prévision), dont il ajoute aussi le test manquant du message d'échec du calcul.

## US

| US | Titre | Statut |
|---|---|---|
| [US-144](US-144-relecture-par-regles.md) | Voir les questions à relire | terminée |
| [US-145](US-145-consigne-relire-le-questionnaire.md) | Demander une relecture à mon assistant d'IA | terminée |
| [US-146](US-146-melange-des-options.md) | Mélanger l'ordre des options d'une question | terminée |

## Décisions

2026-11-05, choix de l'utilisatrice : voir l'historique de SPEC-016. Règles, consigne et mélange : [ADR-0062](../../adr/ADR-0062-aide-a-la-conception-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
