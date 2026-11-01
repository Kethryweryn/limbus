---
id: US-104
titre: Refuser les écritures venues d'un autre site
statut: terminée
epic: EPIC-027
regles: []
adr: [ADR-0053]
---

# US-104 : Refuser les écritures venues d'un autre site

En tant qu'utilisatrice connectée, je veux qu'un autre site ne puisse pas modifier mes données en se servant de ma connexion.

## Critères d'acceptation

- [x] Une requête POST, PUT, PATCH ou DELETE sous `/api/` est refusée (403) quand `Sec-Fetch-Site` vaut `cross-site` ou `same-site`.
- [x] Sans `Sec-Fetch-Site`, l'origine de `Origin` (ou à défaut de `Referer`) doit être celle de `PUBLIC_APP_URL`. Sans aucun des trois, la requête est refusée.
- [x] Les lectures (GET, HEAD) ne sont pas concernées. La route des rapports CSP est la seule exception.
- [x] La connexion et les routes publiques sont concernées comme les autres.

## Tests

- Unitaires : décision selon les en-têtes.
- Intégration : écriture refusée depuis un autre site ou sans indice d'origine, acceptée avec l'`Origin` de l'application.
