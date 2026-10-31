---
id: EPIC-019
titre: Formulaire complet : questions propres au jeu et affinités
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-10-31
---

# EPIC-019 : Formulaire complet : questions propres au jeu et affinités

## Objectif

Première moitié du lot 2 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R8 au complet, R9) : le formulaire d'un jeu pose aussi des questions propres au jeu et les affinités. La seconde moitié, EPIC-020, ouvre ce formulaire au public.

La question d'équilibre (R8, R17) arrive avec la sélection (lot 3), qui en a besoin ; les options reliées aux personnages, au lot 5.

## Décisions

- Les quatre affinités sont chacune activables, et obligatoires ou non, comme les champs standards.
- Une question propre au jeu peut être obligatoire ou facultative, au choix de l'équipe.
- La personne écrit une personne (ou une relation) par ligne dans une affinité.

## US

| US | Titre | Statut |
|---|---|---|
| [US-081](US-081-questions-propres-au-jeu.md) | Poser des questions propres au jeu | terminée |
| [US-082](US-082-affinites.md) | Demander les affinités | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0045](../../../adr/ADR-0045-questions-et-affinites-du-formulaire.md).
