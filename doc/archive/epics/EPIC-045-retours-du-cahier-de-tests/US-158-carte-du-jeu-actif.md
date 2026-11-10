---
id: US-158
titre: Repérer le jeu actif sur la page Jeux
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-158 : Repérer le jeu actif sur la page Jeux

En tant qu'organisatrice, je veux voir d'un coup d'œil quel jeu est actif, afin de ne pas confondre mes jeux (test A1 du cahier).

## Critères d'acceptation

- [x] Étant donné un jeu rendu actif, alors sa carte a un fond vert pâle, en plus du badge « Jeu actif ».

## Notes techniques

`pages/games/index.vue`.

## Tests

`tests/e2e/participate.spec.ts`.
