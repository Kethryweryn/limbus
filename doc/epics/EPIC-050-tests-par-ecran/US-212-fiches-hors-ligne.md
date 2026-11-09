---
id: US-212
titre: Rouvrir hors ligne toute fiche consultée
statut: terminée
epic: EPIC-050
regles: [R1]
adr: []
---

# US-212 : Rouvrir hors ligne toute fiche consultée

En tant qu'organisatrice sur le lieu du jeu, sans réseau, je veux rouvrir toute fiche que j'ai consultée avec le réseau, afin de retrouver un jeu, un groupe, un lieu ou une personne comme je retrouve un personnage ou une session (défaut trouvé en écrivant les tests de l'US-200 : la fiche d'un jeu, même consultée avant, affichait « Une erreur est survenue »).

## Critères d'acceptation

- [x] Étant donné une fiche de jeu, de groupe, d'intrigue, d'objet, de lieu, de document, d'événement ou de participant consultée avec le réseau, quand je la rouvre sans réseau, alors elle s'affiche ; une modification faite hors ligne part au retour du réseau.
- [x] Une fiche jamais consultée avec le réseau dit qu'elle n'est pas disponible hors ligne, au lieu d'une erreur générale.
- [x] Le contact d'urgence et les allergies d'une personne ne sont jamais gardés sur l'appareil (SPEC-007 R1b, US-178) : sans réseau, la fiche dit qu'ils ne sont pas gardés.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09 : toutes les fiches. Les fiches passent par `useOfflineFetch` (rendues côté serveur), ou par `useApiFetch(url, { offlineCache: true })` pour les documents et les événements, comme la fiche d'un personnage depuis l'US-047 ; la route `/api/participants/:id/emergency` reste lue par `useFetch`. La politique de confidentialité parle déjà de la copie des pages consultées, effacée à la déconnexion.

## Tests

`tests/e2e/offlineSheets.spec.ts` : chaque fiche consultée se rouvre sans réseau, l'urgence n'est pas gardée, une fiche jamais consultée le dit. `tests/e2e/participantScreens.spec.ts` : une modification de fiche participant faite hors ligne part au retour du réseau.
