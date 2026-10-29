---
id: US-059
titre: Quitter un jeu partagé
statut: terminée
epic: EPIC-012
regles: [R2]
adr: []
---

# US-059 : Quitter un jeu partagé

En tant que co-organisatrice, je veux me retirer moi-même d'un jeu partagé.

## Critères d'acceptation

- [x] Sur la fiche d'un jeu partagé, une co-organisatrice voit « Quitter ce jeu » ; après confirmation, elle n'y a plus accès et revient à la liste de ses jeux.
- [x] Ce qu'elle a écrit dans le jeu reste.
- [x] La propriétaire ne peut pas quitter son propre jeu.

## Notes techniques

- `DELETE /api/games/:id/shares/:userId` accepte aussi la co-organisatrice elle-même.

## Tests

- Intégration : une co-organisatrice quitte le jeu et perd l'accès ; elle ne retire pas le partage d'une autre.
