---
id: US-222
titre: Savoir que l’éditeur du formulaire demande le réseau pour s’ouvrir
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-222 : Savoir que l’éditeur du formulaire demande le réseau pour s’ouvrir

En tant qu'organisatrice, je veux que l'éditeur du formulaire d'inscription, ouvert sans réseau, dise que son chargement demande une connexion, afin de ne pas lire qu'une action est refusée alors que je n'ai rien fait (défaut trouvé en écrivant les tests de l'US-203).

## Critères d'acceptation

- [x] Étant donné l'éditeur du formulaire ouvert sans réseau, alors il dit « Pas de réseau : cette page demande une connexion. Réessayez quand le réseau revient. », et non « cette action demande une connexion ».
- [x] Sans formulaire chargé, « Enregistrer » est grisé : un formulaire vide n'écrase pas la version en vigueur (revue de la PR #199).
- [x] Un formulaire enregistré hors ligne alors que l'éditeur était déjà ouvert part toujours au retour du réseau (ADR-0036).

## Notes techniques

Suite de l'US-217 : le chargement de `components/RegistrationFormEditor.vue` passe par `loadErrorMessage`, et `formLoaded` garde « Enregistrer » grisé tant que le formulaire n'est pas lu.

## Tests

`tests/e2e/registrationForm.spec.ts` : formulaire enregistré hors ligne puis envoyé au retour du réseau, éditeur rouvert sans réseau, « Enregistrer » grisé.
