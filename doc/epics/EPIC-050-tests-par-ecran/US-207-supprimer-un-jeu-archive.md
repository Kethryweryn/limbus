---
id: US-207
titre: Supprimer définitivement un jeu archivé
statut: terminée
epic: EPIC-050
regles: [R4, R17]
adr: []
---

# US-207 : Supprimer définitivement un jeu archivé

En tant que propriétaire d'un jeu, je veux pouvoir supprimer définitivement un jeu archivé, afin que ce que la spec prévoit soit possible depuis l'écran (défaut trouvé en écrivant les tests de l'US-198 : depuis avril 2025, seul « Archiver » restait).

## Critères d'acceptation

- [x] Étant donné un jeu archivé, sa fiche propose « Supprimer définitivement » à sa propriétaire, ou à l'administratrice en mode administrateur ; un jeu actif ne le propose pas, ni une co-organisatrice.
- [x] La confirmation demande de retaper le titre du jeu ; un autre titre affiche « Le titre ne correspond pas. », et rien n'est supprimé.
- [x] Une fois supprimé, le jeu et tout ce qui lui appartient disparaissent (R4), et l'écran revient à la liste des jeux.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09 : le bouton sur un jeu archivé seulement, avec le titre à retaper. `components/GameDeleteModal.vue`, `pages/games/[slug].vue` ; la route `DELETE /api/games/:id` existait déjà, réservée à la propriétaire (`requireGameOwner`).

## Tests

`tests/e2e/games.spec.ts` : seul un jeu archivé se supprime, en retapant son titre, et tout son contenu part avec lui.
