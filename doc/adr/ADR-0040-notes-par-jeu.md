---
id: ADR-0040
titre: Les notes sur une personne sont portées par son lien à chaque jeu
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0007-isolation-par-jeu.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0040 : Les notes sur une personne sont portées par son lien à chaque jeu

## Contexte

Une fiche participant est commune à tous ses jeux ([SPEC-007](../specs/SPEC-007-participants-et-rgpd.md), R2) ; son champ `notes` aussi, si bien qu'une équipe lit et modifie ce qu'une autre a écrit. [SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R10) veut des notes propres à chaque équipe.

## Décision

- La note vit sur `ParticipantGame` (le lien entre la personne et un jeu), colonne `notes`. L'accès suit celui du jeu ([ADR-0007](ADR-0007-isolation-par-jeu.md)) : les routes ne lisent et n'écrivent que les liens des jeux accessibles.
- L'API expose et reçoit `gameNotes`, un objet `{ idDuJeu: texte }`, à côté de la liste des jeux.
- La migration copie `Participant.notes` dans chaque lien, puis vide `Participant.notes`. La colonne reste, pour le build en service pendant le déploiement ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)) ; plus rien ne l'écrit ni ne la lit, et une migration ultérieure la supprimera.

## Conséquences

- Retirer une personne d'un jeu supprime le lien, donc la note de ce jeu.
- Les routes de sessions qui incluent la fiche entière n'exposent plus de notes : le champ est vide.

## Options écartées

- **Une note par propriétaire** : une co-organisatrice d'un seul jeu verrait ce qui concerne les autres jeux de la propriétaire.
- **Une table de notes à part** : le lien personne-jeu existe déjà, avec le bon contrôle d'accès.
