---
id: US-054
titre: Test de bout en bout des trombinoscopes
statut: terminée
epic: EPIC-011
regles: []
adr: [ADR-0037]
---

# US-054 : Test de bout en bout des trombinoscopes

En tant qu'organisatrice, je veux qu'un test automatique vérifie la génération des trombinoscopes dans un vrai navigateur à chaque PR, pour qu'une modification ne le casse pas sans qu'on le voie avant la mise en production.

## Critères d'acceptation

- [x] Le test génère les trombinoscopes d'une session castée depuis l'onglet « Documents ».
- [x] Il ouvre le trombinoscope d'un personnage et vérifie que c'est un PDF.

## Notes techniques

- Playwright (`tests/e2e/`), sur le jeu commun préparé par `globalSetup.ts` ([ADR-0037](../../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)).

## Tests

- Le test lui-même, dans la CI de la PR.
