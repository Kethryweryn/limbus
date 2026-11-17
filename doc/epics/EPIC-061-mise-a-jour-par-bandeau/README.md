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

Après un déploiement, aucune page ne se recharge d'elle-même : un bandeau propose de recharger, et la personne choisit le moment (R14 de [SPEC-010](../../specs/SPEC-010-hors-ligne.md), [ADR-0093](../../adr/ADR-0093-mise-a-jour-par-bandeau.md)). Au retour du réseau, l'envoi des modifications faites hors ligne ne recharge plus la page non plus (R7).

## US

| US | Titre | Statut |
|---|---|---|
| [US-254](US-254-bandeau-de-mise-a-jour.md) | Charger une nouvelle version quand je le décide | terminée |
| [US-255](US-255-retour-du-reseau-sans-rechargement.md) | Retrouver le réseau sans que la page se recharge | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
