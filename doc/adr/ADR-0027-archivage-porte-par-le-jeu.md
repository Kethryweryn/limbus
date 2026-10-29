---
id: ADR-0027
titre: L'état archivé du contenu est celui de son jeu
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-003-ecriture-d-un-jeu.md, ../epics/EPIC-003-ecarts-ecriture-d-un-jeu/US-013-contenu-archive-avec-son-jeu.md, ADR-0024]
---

# ADR-0027 : L'état archivé du contenu est celui de son jeu

## Contexte

Archiver un jeu archive tout son contenu ([SPEC-003](../specs/SPEC-003-ecriture-d-un-jeu.md), R3) ; il n'y a pas d'archivage élément par élément. Pourtant, personnages, factions, intrigues, objets, documents, événements de chronologie et lieux ont chacun un champ `published` et un badge « Archivé ». Aucune action ne change ce champ : il vaut toujours vrai, et le contenu d'un jeu archivé reste affiché comme actif (SPEC-003, écart 1).

## Décision

- L'état archivé d'un élément de contenu se lit sur son jeu (`game.published`, via `isArchivedGame`). Il n'est stocké nulle part ailleurs.
- L'API n'accepte plus `published` dans le corps des créations et modifications de contenu, et ne l'écrit plus. L'interface ne le lit plus.
- Les colonnes `published` de ces sept tables restent en base, inutilisées, avec leur valeur par défaut : les supprimer casserait le build encore en service pendant le déploiement ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). Leur suppression se fera dans une migration à part, une fois ce changement déployé.

## Conséquences

- Archiver ou restaurer un jeu n'écrit qu'une ligne, et le contenu suit sans risque de désaccord.
- Les colonnes inutilisées restent jusqu'à leur suppression ; elles sont encore copiées lors d'un legs, sans effet.
- `Session.published` et `Participant.published` ne sont pas concernés : ils relèvent de SPEC-004 et SPEC-007.

## Options écartées

- **Recopier l'état sur chaque élément** à l'archivage et à la restauration : l'état serait stocké deux fois et pourrait diverger (élément créé pendant l'archivage, restauration partielle en cas d'erreur).
- **Archivage élément par élément** : SPEC-003 ne le prévoit pas, et l'utilisatrice ne l'a pas demandé.
