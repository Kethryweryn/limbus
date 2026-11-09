---
id: US-215
titre: Voir pourquoi une page d'administration est refusée
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-215 : Voir pourquoi une page d'administration est refusée

En tant qu'organisatrice qui n'administre pas Limbus, je veux qu'une page d'administration ouverte par son adresse me dise qu'elle est réservée, afin de ne pas rester devant une page vide (défaut trouvé en écrivant les tests de l'US-201).

## Critères d'acceptation

- [ ] Étant donné une organisatrice qui n'administre pas, quand elle ouvre `/admin/users` ou `/admin/smtp`, alors la page affiche « Réservé à l’administration », sans formulaire.

## Notes techniques

Choix de l'utilisatrice le 2026-11-10 : un message de refus plutôt qu'un retour à l'accueil. Les deux pages affichent le refus du serveur (403) au lieu de le laisser vider la page : le serveur reste seul juge du rôle.

## Tests

`tests/e2e/accountScreens.spec.ts` : ni menu, ni page d'administration pour une organisatrice.
