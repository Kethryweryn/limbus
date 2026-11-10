---
id: EPIC-051
titre: Place prise, effacement et désactivation du hors ligne
statut: à faire
spec: ../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-10
---

# EPIC-051 : Place prise, effacement et désactivation du hors ligne

## Objectif

Dans « Mon compte », une personne voit la place que prennent les données gardées sur son appareil, les efface sans se déconnecter, ou désactive le hors ligne sur un appareil prêté (SPEC-019, R1 à R7).

## US

| US | Titre | Statut |
|---|---|---|
| [US-223](US-223-voir-la-place-prise.md) | Voir la place que prennent les données hors ligne de mon appareil | à faire |
| [US-224](US-224-effacer-l-appareil.md) | Effacer les données hors ligne de mon appareil sans me déconnecter | à faire |
| [US-225](US-225-desactiver-le-hors-ligne.md) | Désactiver le hors ligne sur un appareil prêté | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises ; tests de bout en bout sur les quatre axes (ADR-0079).
- Une note dans `nouveautes/` pour chaque PR.
