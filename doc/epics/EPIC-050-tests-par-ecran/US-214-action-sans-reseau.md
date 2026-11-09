---
id: US-214
titre: Savoir qu'une action demande le réseau
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-214 : Savoir qu'une action demande le réseau

En tant que personne qui utilise Limbus sans réseau, je veux qu'une action qui ne peut pas partir me dise qu'il manque le réseau, afin de réessayer au bon moment (défaut trouvé en écrivant les tests de l'US-201 : l'inscription affichait « Impossible de créer le compte. » et « Mon compte », « Erreur inconnue »).

## Critères d'acceptation

- [ ] Étant donné une action qui demande le réseau (créer son compte, changer son nom, son adresse, son mot de passe, ses coordonnées, inviter…), quand le réseau manque, alors la page affiche « Pas de réseau : cette action demande une connexion. Réessayez quand le réseau revient. », et rien n'est enregistré.
- [ ] Une modification que Limbus met en file hors ligne (fiches, listes) n'est pas touchée : elle part toujours au retour du réseau.

## Notes techniques

Choix de l'utilisatrice le 2026-11-10 : un message clair plutôt qu'un bouton grisé. `utils/apiErrors.ts` : `apiErrorMessage` rend ce message pour une erreur de réseau (`isNetworkError`), au lieu du texte technique de `$fetch`. Il vaut pour toutes les actions de Limbus, puisque toutes passent par cette fonction.

## Tests

`tests/e2e/accountScreens.spec.ts` : inscription et changement de nom hors ligne. `tests/utils/apiErrors.test.ts`.
