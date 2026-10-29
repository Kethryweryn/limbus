---
id: US-053
titre: Test de bout en bout du casting
statut: terminée
epic: EPIC-011
regles: []
adr: [ADR-0037]
---

# US-053 : Test de bout en bout du casting

En tant qu'organisatrice, je veux qu'un test automatique vérifie le casting d'une session dans un vrai navigateur à chaque PR, pour qu'une modification ne le casse pas sans qu'on le voie avant la mise en production.

## Critères d'acceptation

- [x] Le test crée une session depuis la liste des sessions, avec son équipe.
- [x] Il affecte des participants aux personnages depuis l'onglet « Cast », enregistre, recharge la page et retrouve le casting.

## Notes techniques

- Playwright (`tests/e2e/`), sur le jeu commun préparé par `globalSetup.ts` ([ADR-0037](../../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)).

## Tests

- Le test lui-même, dans la CI de la PR.
