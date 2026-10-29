---
id: US-055
titre: Test de bout en bout de l'envoi des documents
statut: terminée
epic: EPIC-011
regles: []
adr: [ADR-0037]
---

# US-055 : Test de bout en bout de l'envoi des documents

En tant qu'organisatrice, je veux qu'un test automatique vérifie l'envoi des documents dans un vrai navigateur à chaque PR, pour qu'une modification ne le casse pas sans qu'on le voie avant la mise en production.

## Critères d'acceptation

- [x] Le test envoie un document à la session depuis l'onglet « Documents ».
- [x] Le serveur SMTP de test reçoit un email par personne castée, avec le document en pièce jointe.

## Notes techniques

- Playwright (`tests/e2e/`), sur le jeu commun préparé par `globalSetup.ts` ([ADR-0037](../../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)).

## Tests

- Le test lui-même, dans la CI de la PR.
