---
id: US-218
titre: Ne pas lire « introuvable » quand son inscription ne peut pas se charger
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-218 : Ne pas lire « introuvable » quand son inscription ne peut pas se charger

En tant que personne inscrite, je veux que mon inscription, ouverte depuis « Je participe » ou par mon lien personnel, dise que le réseau manque ou que le serveur ne répond pas, afin de ne pas croire mon inscription perdue ou mon lien invalide (défaut trouvé en écrivant les tests de l'US-202).

## Critères d'acceptation

- [x] Étant donné une inscription ouverte sans réseau, alors la page dit « Pas de réseau : cette page demande une connexion. Réessayez quand le réseau revient. », et non « Inscription introuvable » ni « Lien invalide ».
- [x] Étant donné une panne du serveur au chargement, alors la page le dit, sans parler d'inscription introuvable.
- [x] Étant donné une inscription d'une autre personne, ou un lien inconnu, alors la page dit toujours « Inscription introuvable » ou « Lien invalide ».
- [x] Le lien reçu après le formulaire public ne tente la confirmation de l'adresse que si le lien n'est pas encore reconnu, et non après une coupure du réseau.

## Notes techniques

Choix de l'utilisatrice le 2026-11-10 : un message clair, plutôt qu'une inscription lisible hors ligne. `components/RegistrationResponse.vue` ne traite en « introuvable » qu'une réponse 404 ; les autres erreurs passent par `loadErrorMessage`, sous le titre « Inscription indisponible ». Depuis le compte, une session expirée renvoie à l'écran de connexion (revue de la PR #197).

## Tests

`tests/e2e/participantSpace.spec.ts` : inscription ouverte sans réseau depuis « Je participe », panne du serveur, lien personnel sans réseau (aucune confirmation tentée), lien inconnu et inscription d'une autre personne toujours introuvables, session expirée renvoyée à l'écran de connexion.
