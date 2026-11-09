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
- [x] La carte suit la présentation des autres listes : nom en titre, jeu et archive en badges, adresse et notes résumées, boutons en bas ; la liste met le dernier lieu modifié en tête.
- [x] Dans toutes les listes du jeu, Entrée sur un bouton d'une carte fait l'action du bouton, sans ouvrir la fiche.

## Notes techniques

`components/ContentCard.vue`, carte commune aux listes des jeux, personnages, groupes, intrigues, objets, documents et lieux ([US-179](US-179-carte-participant-cliquable.md) pour les participants, qui gardent le lien du nom). La page Lieux était la seule liste du jeu sans carte cliquable. Revue de la PR : la carte recopiée dans sept pages devient ce composant, et Entrée n'ouvre la carte que lorsqu'elle a elle-même le focus (`@keydown.enter.self`, timeline comprise).

## Tests

`tests/e2e/writing.spec.ts` : pour chaque élément du jeu (personnage, groupe, intrigue, objet, document, lieu), la fiche s'ouvre d'un clic sur la carte et par Entrée, et Entrée sur « Modifier » ouvre le formulaire sans ouvrir la fiche.
