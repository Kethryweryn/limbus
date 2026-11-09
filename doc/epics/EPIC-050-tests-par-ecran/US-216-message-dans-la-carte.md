---
id: US-216
titre: Lire le résultat d'un formulaire du compte à côté de son bouton
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-216 : Lire le résultat d'un formulaire du compte à côté de son bouton

En tant que personne qui gère son compte, ou administratrice qui gère les comptes, je veux lire l'erreur ou la confirmation d'un formulaire sous son bouton, afin de la voir sans chercher en bas de la page (défaut trouvé en écrivant les tests de l'US-201).

## Critères d'acceptation

- [ ] Étant donné « Mon compte », quand un formulaire (nom, adresse, mot de passe, coordonnées, effacement) est refusé ou enregistré, alors son message s'affiche dans sa carte, sous son bouton.
- [ ] Étant donné « Utilisateurs », le résultat de la création s'affiche dans sa carte, et celui d'une action sur un compte (enregistrer, lien de mot de passe, désactiver, supprimer) dans la carte de ce compte ; « Enregistrer » confirme « Compte enregistré. ».

## Notes techniques

Choix de l'utilisatrice le 2026-11-10 : dans la carte, plutôt qu'en haut de la page.

## Tests

`tests/e2e/accountScreens.spec.ts` : messages lus dans la carte du formulaire ou du compte.
