---
id: US-052
titre: La file part à l'ouverture de l'application
statut: à faire
epic: EPIC-010
regles: [R7]
adr: []
---

# US-052 : La file part à l'ouverture de l'application

En tant qu'organisatrice, je veux que mes modifications en attente partent dès que je rouvre l'application avec le réseau.

## Critères d'acceptation

- [ ] À l'ouverture de l'application, si le serveur répond, la file en attente est envoyée sans autre action.

## Notes techniques

- `app.vue` : envoi après la vérification de la connexion au montage.

## Tests

- Bout en bout : une modification en attente dans la file part à l'ouverture.
