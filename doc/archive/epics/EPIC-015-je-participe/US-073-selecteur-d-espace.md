---
id: US-073
titre: Sélecteur d'espace « J'organise » / « Je participe »
statut: terminée
epic: EPIC-015
regles: []
adr: [ADR-0041]
---

# US-073 : Sélecteur d'espace « J'organise » / « Je participe »

En tant que personne qui organise et qui joue, je veux passer d'un espace à l'autre en un clic.

## Critères d'acceptation

- [x] En haut de l'écran, un sélecteur « J'organise » / « Je participe », visible seulement pour qui a un jeu à organiser et une fiche rattachée.
- [x] Le menu de gauche suit l'espace : celui de l'organisation, ou « Mes jeux » et « Organiser un GN » côté participant.
- [x] À l'ouverture, Limbus rouvre le dernier espace utilisé sur cet appareil ; la première fois, « J'organise » si la personne a un jeu à organiser, sinon « Je participe ».

## Notes techniques

- `GET /api/auth/me` renvoie `spaces: { organize, participate }`. Le dernier espace est gardé dans le navigateur.

## Tests

- Intégration : `spaces` selon les jeux et les fiches ; bout en bout : un compte qui ne fait que participer arrive sur « Je participe ».
