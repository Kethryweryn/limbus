---
id: US-179
titre: Ouvrir une fiche en cliquant sur sa carte
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-179 : Ouvrir une fiche en cliquant sur sa carte

En tant qu'organisatrice, je veux ouvrir la fiche d'une personne en cliquant n'importe où sur sa carte, afin de ne pas devoir viser son nom (test A5 du cahier, retour A5-3).

## Critères d'acceptation

- [x] Étant donné la page Participants, quand je clique sur une carte, alors la fiche de la personne s'ouvre.
- [x] Étant donné les boutons « Modifier » et « Supprimer » d'une carte, quand je clique dessus, alors ils font leur action sans ouvrir la fiche.

## Notes techniques

`pages/participants/index.vue`.

## Tests

`tests/e2e/participants.spec.ts`.
