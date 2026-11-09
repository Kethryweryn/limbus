---
id: US-197
titre: Ouvrir un lieu en cliquant sur sa carte
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-197 : Ouvrir un lieu en cliquant sur sa carte

En tant qu'organisatrice, je veux que la page Lieux présente ses cartes comme les autres listes du jeu, afin d'ouvrir un lieu d'un clic sur sa carte (retour du cahier de tests, 2026-11-09).

## Critères d'acceptation

- [x] Étant donné la page Lieux, quand je clique sur une carte, hors de ses boutons, alors la fiche du lieu s'ouvre ; la touche Entrée fait de même.
- [x] « Modifier » et « Supprimer » restent sur la carte et n'ouvrent pas la fiche.
- [x] La carte suit la présentation des autres listes : nom en titre, jeu et archive en badges, adresse et notes résumées, boutons en bas.

## Notes techniques

`pages/locations/index.vue`, sur le modèle de `pages/items/index.vue` ([US-179](US-179-carte-participant-cliquable.md) pour les participants). La page Lieux était la seule liste du jeu sans carte cliquable.

## Tests

`tests/e2e/writing.spec.ts` : pour chaque élément du jeu (personnage, groupe, intrigue, objet, document, lieu), la fiche s'ouvre d'un clic sur la carte.
