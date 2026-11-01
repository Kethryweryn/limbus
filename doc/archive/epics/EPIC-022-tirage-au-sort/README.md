---
id: EPIC-022
titre: Tirage au sort, mode mixte, pondérations et équilibre
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-11-01
---

# EPIC-022 : Tirage au sort, mode mixte, pondérations et équilibre

## Objectif

Seconde moitié du lot 3 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R4, R8, R17, R18), après la sélection à la main ([EPIC-021](../EPIC-021-selection-a-la-main/README.md)) : une période ordinaire en mode formulaire sélectionne au hasard, ou en mode mixte, avec deux pondérations facultatives et un journal reproductible.

## Décisions

- Le tirage range les inscriptions comme l'équipe à la main : elle corrige, puis annonce.
- Il procède session par session, dans l'ordre des dates.
- Les personnes sans place vont en liste d'attente, dans la limite d'une taille réglée par période ; les autres sont non retenues.
- « Non tirés avant » double les chances.
- Mode mixte : chaque organisatrice retient elle-même jusqu'à N personnes par session, puis le tirage remplit le reste.
- Un tirage s'annule et se refait tant que rien n'est annoncé ; le journal les garde tous.
- L'attribut d'équilibre est défini par jeu, avec ses valeurs ; chaque PJ en porte une.
- « Peu importe » comble la valeur qui a le plus de places libres ; une valeur sans assez de candidates laisse ses places libres.

## US

| US | Titre | Statut |
|---|---|---|
| [US-091](US-091-attribut-et-question-d-equilibre.md) | Attribut d'équilibre des personnages et question d'équilibre | terminée |
| [US-092](US-092-mode-de-selection.md) | Mode de sélection, mode mixte et réglages du tirage | terminée |
| [US-093](US-093-tirer-au-sort.md) | Tirer au sort, avec pondérations et équilibre | terminée |
| [US-094](US-094-journal-des-tirages.md) | Journal des tirages, annuler et refaire | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0048](../../../adr/ADR-0048-tirage-au-sort.md).
