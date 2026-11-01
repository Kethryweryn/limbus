---
id: US-103
titre: Page de santé de Limbus
statut: terminée
epic: EPIC-026
regles: []
adr: [ADR-0052]
---

# US-103 : Page de santé de Limbus

En tant qu'exploitante, je veux qu'un service de surveillance sache si Limbus fonctionne, et quelle version est en ligne.

## Critères d'acceptation

- [x] `GET /api/public/health` répond 200 avec `{ "status": "ok", "version": "<commit>" }` quand la base répond.
- [x] Elle répond 503 avec `{ "status": "error" }` quand la base ne répond pas, ou pas dans les 3 secondes.
- [x] Elle ne renvoie aucune autre donnée, n'exige pas de connexion, et ne se met pas en cache.
- [x] La version est le commit déployé, écrit par `deploy.sh` à côté du build ; sans ce fichier (développement, tests), `version` vaut `null`.

## Tests

- Unitaires : version lue ou absente.
- Intégration : 200 et la forme de la réponse, sans connexion.
