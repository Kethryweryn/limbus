---
id: US-057
titre: Test de bout en bout de la session hors ligne
statut: à faire
epic: EPIC-011
regles: []
adr: [ADR-0037]
---

# US-057 : Test de bout en bout de la session hors ligne

En tant qu'organisatrice, je veux qu'un test automatique vérifie la page de session hors ligne dans un vrai navigateur à chaque PR, pour qu'une modification ne le casse pas sans qu'on le voie avant la mise en production.

## Critères d'acceptation

- [ ] Le test ouvre une session avec le réseau, coupe le réseau et la rouvre depuis l'appareil.
- [ ] Il modifie le casting sans réseau : le bandeau indique une modification en attente.
- [ ] Au retour du réseau, la modification part et le serveur l'enregistre.

## Notes techniques

- Playwright (`tests/e2e/`), sur le jeu commun préparé par `globalSetup.ts` ([ADR-0037](../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)).

## Tests

- Le test lui-même, dans la CI de la PR.
