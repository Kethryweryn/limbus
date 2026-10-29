---
id: EPIC-003
titre: Corriger les écarts de l'écriture d'un jeu
statut: en cours
spec: ../../specs/SPEC-003-ecriture-d-un-jeu.md
date: 2026-10-29
---

# EPIC-003 : Corriger les écarts de l'écriture d'un jeu

## Objectif

Aligner le code sur [SPEC-003](../../specs/SPEC-003-ecriture-d-un-jeu.md) : corriger les quatre écarts relevés en documentant l'existant, avec les choix faits par l'utilisatrice le 29 octobre 2026.

## US

| US | Titre | Statut |
|---|---|---|
| [US-013](US-013-contenu-archive-avec-son-jeu.md) | Le contenu d'un jeu archivé est archivé avec lui | à faire |
| [US-014](US-014-quantite-d-un-objet.md) | Saisir la quantité d'un objet | terminée |
| [US-015](US-015-intrigue-sans-pret-a-envoyer.md) | Retirer « prête à envoyer » des intrigues | terminée |
| [US-016](US-016-archiver-depublie-la-page.md) | Archiver un jeu dépublie sa page publique | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-003 à jour : les écarts corrigés sortent de la liste, les règles décrivent le nouveau comportement.
- [ADR-0027](../../adr/ADR-0027-archivage-porte-par-le-jeu.md) pour l'état archivé du contenu.
