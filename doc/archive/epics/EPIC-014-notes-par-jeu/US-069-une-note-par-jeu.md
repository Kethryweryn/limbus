---
id: US-069
titre: Une note par jeu sur la fiche d'une personne
statut: terminée
epic: EPIC-014
regles: [R10]
adr: [ADR-0040]
---

# US-069 : Une note par jeu sur la fiche d'une personne

En tant qu'organisatrice, je veux que mes notes sur une personne ne soient lues que par l'équipe de mon jeu, et que celles des autres équipes ne m'apparaissent pas.

## Critères d'acceptation

- [x] Sur la fiche et dans son formulaire, un bloc « Notes » par jeu de la personne, pour les seuls jeux auxquels on a accès.
- [x] Modifier la note d'un jeu ne touche pas celle des autres jeux ; une note d'un jeu inaccessible est refusée (403).
- [x] La liste des participants n'affiche que les notes des jeux accessibles.
- [x] Retirer la personne d'un jeu efface la note de ce jeu ; l'export des données d'une personne ne contient que les notes des jeux accessibles.
- [x] Les notes existantes sont copiées dans chaque jeu de la personne ; l'ancien champ commun n'est plus montré nulle part.
- [x] Modifiée hors ligne, la note part avec la fiche, comme aujourd'hui.

## Notes techniques

- Colonne `ParticipantGame.notes` ; la migration copie `Participant.notes` puis le vide (colonne gardée pour le build en service, supprimée plus tard).
- Corps de `POST`/`PUT /api/participants` : `gameNotes`, un texte par identifiant de jeu ; réponse : `gameNotes` des jeux accessibles.

## Tests

- Intégration : deux équipes sur la même fiche (jeu d'Alice et jeu de Bob) ; chacune ne lit et n'écrit que sa note, avec un témoin positif ; export limité.
