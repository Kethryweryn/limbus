---
id: EPIC-055
titre: Une session sans nom, désignée par sa date
statut: en cours
spec: ../../specs/SPEC-021-session-sans-nom.md
date: 2026-11-11
---

# EPIC-055 : Une session sans nom, désignée par sa date

## Objectif

Une session n'a plus de nom à saisir : Limbus la désigne par sa date, avec l'heure ou le lieu en cas de doublon, et le jeu devant hors des pages du jeu ([SPEC-021](../../specs/SPEC-021-session-sans-nom.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-234](US-234-libelle-calcule.md) | Une session désignée par sa date, sans nom à saisir | terminée |
| [US-235](US-235-jeu-devant-le-libelle.md) | Le jeu devant le libellé, hors des pages du jeu | à faire |
| [US-236](US-236-supprimer-la-colonne-du-nom.md) | Supprimer la colonne du nom des sessions | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
