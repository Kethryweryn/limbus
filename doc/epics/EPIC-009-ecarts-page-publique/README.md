---
id: EPIC-009
titre: Corriger les écarts de la page publique
statut: en cours
spec: ../../specs/SPEC-009-page-publique.md
date: 2026-10-29
---

# EPIC-009 : Corriger les écarts de la page publique

## Objectif

Corriger les écarts 1 (crédit), 2 (lien stable) et 4 (teaser YouTube) de [SPEC-009](../../specs/SPEC-009-page-publique.md), avec les choix faits par l'utilisatrice le 29 octobre 2026. L'écart 3 (contenu choisi par l'organisation) vient avec le formulaire public des inscriptions ([feuille de route](../../feuille-de-route.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-044](US-044-credit-sur-la-page-publique.md) | Le crédit d'une copie sur la page publique | terminée |
| [US-045](US-045-lien-stable-de-la-page-publique.md) | L'adresse de la page publique survit au renommage | à faire |
| [US-046](US-046-teaser-youtube-au-clic.md) | Teaser YouTube chargé seulement au clic | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- SPEC-009 à jour.
- [ADR-0035](../../adr/ADR-0035-anciens-slugs-d-un-jeu.md).
