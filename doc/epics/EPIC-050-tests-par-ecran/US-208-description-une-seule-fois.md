---
id: US-208
titre: Lire la description d'un jeu une seule fois
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-208 : Lire la description d'un jeu une seule fois

En tant que personne qui lit la fiche ou la page publique d'un jeu, je veux lire sa description une seule fois, afin que la page ne se répète pas (remarque du cahier de tests au test C1, confirmée en écrivant les tests de l'US-198).

## Critères d'acceptation

- [x] Étant donné la fiche ou la page publique d'un jeu, alors sa description s'affiche une fois, sous son titre ; la carte « Description » n'existe plus.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09 : sous le titre. `components/GamePageContent.vue`, commun à la fiche et à la page publique.

## Tests

`tests/e2e/publicPage.spec.ts` : sans les cases de la fiche, la page ne montre que la présentation, une seule fois.
