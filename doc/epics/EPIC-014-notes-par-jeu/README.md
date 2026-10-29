---
id: EPIC-014
titre: Notes d'organisation propres à chaque jeu
statut: en cours
spec: ../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-014 : Notes d'organisation propres à chaque jeu

## Objectif

Lot 3 de [SPEC-011](../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R10) : ce qu'une équipe écrit sur une personne reste à cette équipe. Corrige la partie « notes » de l'écart 1 de [SPEC-007](../../specs/SPEC-007-participants-et-rgpd.md) ; les coordonnées passent à la personne au lot 5.

## Décisions

- Une note par jeu de la personne (et non par propriétaire) : on ne voit et ne modifie que les notes des jeux auxquels on a accès.
- Les notes existantes sont copiées dans chaque jeu de la personne.

## US

| US | Titre | Statut |
|---|---|---|
| [US-069](US-069-une-note-par-jeu.md) | Une note par jeu sur la fiche d'une personne | à faire |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0040](../../adr/ADR-0040-notes-par-jeu.md).
