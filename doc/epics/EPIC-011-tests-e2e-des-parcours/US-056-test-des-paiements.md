---
id: US-056
titre: Test de bout en bout des paiements
statut: à faire
epic: EPIC-011
regles: []
adr: [ADR-0037]
---

# US-056 : Test de bout en bout des paiements

En tant qu'organisatrice, je veux qu'un test automatique vérifie les paiements dans un vrai navigateur à chaque PR, pour qu'une modification ne le casse pas sans qu'on le voie avant la mise en production.

## Critères d'acceptation

- [ ] Le test crée un tarif, note un versement, offre une place depuis l'onglet « Paiements ».
- [ ] Il envoie l'email de paiement : le serveur SMTP de test le reçoit pour les personnes qui doivent encore payer, et pas pour la place offerte.

## Notes techniques

- Playwright (`tests/e2e/`), sur le jeu commun préparé par `globalSetup.ts` ([ADR-0037](../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)).

## Tests

- Le test lui-même, dans la CI de la PR.
