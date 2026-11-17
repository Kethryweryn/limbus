---
id: EPIC-061
titre: Une nouvelle version se charge depuis un bandeau
statut: en cours
spec: ../../specs/SPEC-010-hors-ligne.md
origine: ../../archive/todo/mise-a-jour-par-bandeau.md
date: 2026-11-17
---

# EPIC-061 : Une nouvelle version se charge depuis un bandeau

## Objectif

Après un déploiement, aucune page ne se recharge d'elle-même : un bandeau propose de recharger, et la personne choisit le moment (R14 de [SPEC-010](../../specs/SPEC-010-hors-ligne.md), [ADR-0093](../../adr/ADR-0093-mise-a-jour-par-bandeau.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-254](US-254-bandeau-de-mise-a-jour.md) | Charger une nouvelle version quand je le décide | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
