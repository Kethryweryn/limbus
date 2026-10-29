---
id: US-036
titre: Une fiche a toujours au moins un jeu
statut: à faire
epic: EPIC-007
regles: [R3, R9]
adr: []
---

# US-036 : Une fiche a toujours au moins un jeu

En tant qu'organisatrice, je veux qu'aucune fiche ne reste en base sans jeu, invisible de toutes, afin que les données des participants ne traînent pas.

## Critères d'acceptation

- [ ] Créer une fiche demande au moins un jeu (400 sinon), et le formulaire l'exige.
- [ ] Retirer le dernier lien d'une fiche la supprime, avec ses données (`eraseParticipant`), après une confirmation qui le dit. Une fiche encore liée au jeu d'une autre équipe n'est pas supprimée.
- [ ] La migration supprime les fiches qui n'ont aucun jeu ; leurs personnages restent au casting, sans joueur ni photo.

## Notes techniques

- Schéma de création distinct (`participantCreateSchema`, `gameIds` d'au moins un élément).
- Migration SQL : casting détaché et photos d'attribution retirées, puis suppression des fiches sans lien. Les fichiers photo eux-mêmes restent sur le disque, sans référence.

## Tests

- Intégration (`participants.test.ts`) : création sans jeu refusée, retrait du dernier lien qui supprime la fiche, fiche partagée gardée.
