---
id: US-097
titre: Relier les personnages entre eux
statut: terminée
epic: EPIC-024
regles: [R26]
adr: [ADR-0050]
---

# US-097 : Relier les personnages entre eux

En tant qu'organisatrice, je veux noter les relations entre les personnages de mon jeu, et choisir ce que chaque joueur en apprend par sa fiche.

## Critères d'acceptation

- [x] Sur la page d'un personnage, l'équipe ajoute, modifie et supprime ses relations : l'autre personnage (du même jeu), le type, un libellé facultatif pour chaque côté, une description, et une case « visible du joueur » pour chaque côté.
- [x] La relation apparaît sur la page des deux personnages, chacun avec son libellé.
- [x] La fiche personnage envoyée (PDF et email) contient une section « Relations » avec les relations visibles de ce côté. Une fiche déjà envoyée est signalée comme dépassée quand ces relations changent.
- [x] Supprimer un personnage supprime ses relations ; la copie d'un jeu (legs) copie les relations.

## Notes techniques

- `CharacterRelation` ; `GET /api/characters/:id/relations`, `POST /api/character-relations`, `PUT` et `DELETE /api/character-relations/:id`.

## Tests

- Intégration : création, refus d'un personnage d'un autre jeu ou de lui-même, modification concurrente, fiche PDF, copie de jeu, isolation des routes.
