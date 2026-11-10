---
id: EPIC-054
titre: Une page Inscriptions par jeu, en onglets
statut: en cours
spec: ../../specs/SPEC-020-page-inscriptions.md
date: 2026-11-10
---

# EPIC-054 : Une page Inscriptions par jeu, en onglets

## Objectif

La page Inscriptions ne mélange plus les jeux, les sessions, le vivier et les réglages : un résumé de ses jeux avec ce qui reste à traiter, puis une page par jeu en trois onglets, aux sessions repliées, avec un vivier où l'on cherche ([SPEC-020](../../specs/SPEC-020-page-inscriptions.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-230](US-230-page-d-un-jeu-en-onglets.md) | La page Inscriptions d'un jeu en trois onglets, et le résumé des jeux | terminée |
| [US-231](US-231-sessions-repliees.md) | Sessions repliées, dans l'adresse, avec leurs tirages | terminée |
| [US-232](US-232-recherche-dans-le-vivier.md) | Rechercher et filtrer dans le vivier | terminée |
| [US-233](US-233-a-traiter.md) | Ce qui reste à traiter, par jeu et par session | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
