---
id: US-157
titre: Comprendre qu'une page n'est pas accessible
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-157 : Comprendre qu'une page n'est pas accessible

En tant que personne qui ouvre une page interdite ou absente, je veux un message clair et un chemin de retour, afin de ne pas rester devant un écran sans explication (test A3 du cahier).

## Critères d'acceptation

- [x] Étant donné une page refusée, absente ou une session expirée, alors la page dit qu'elle n'existe pas ou n'est pas accessible, sans préciser laquelle des deux.
- [x] Étant donné ce message, alors un bouton ramène à l'accueil.
- [x] Étant donné une autre erreur, alors un message invite à réessayer.

## Notes techniques

`error.vue`.

## Tests

`tests/e2e/participate.spec.ts`.
