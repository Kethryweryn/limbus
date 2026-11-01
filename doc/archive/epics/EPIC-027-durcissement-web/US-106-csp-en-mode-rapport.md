---
id: US-106
titre: CSP et COOP sur les pages, d'abord en mode rapport
statut: terminée
epic: EPIC-027
regles: []
adr: [ADR-0053]
---

# US-106 : CSP et COOP sur les pages, d'abord en mode rapport

En tant qu'exploitante, je veux qu'un script injecté ne puisse pas s'exécuter dans Limbus, sans que la découverte d'une ressource oubliée casse des pages en production.

## Critères d'acceptation

- [x] Les pages ont une CSP stricte :
  - scripts par nonce et `strict-dynamic` ;
  - `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'self'` ;
  - iframes YouTube seulement ;
  - images du site, ou en HTTPS.
- [x] La CSP est envoyée en `Content-Security-Policy-Report-Only` : rien n'est bloqué.
- [x] Les violations sont envoyées à `POST /api/public/csp-report`, publique et limitée en débit. Elle les compte en base par directive, par ressource bloquée et par page.
- [x] L'administratrice lit les violations par `GET /api/admin/csp-reports`.
- [x] Les pages ont `Cross-Origin-Opener-Policy: same-origin`.
- [x] Les autres fonctions de Nuxt Security sont désactivées, car Limbus a les siennes : limites de débit et de taille, filtre XSS, CORS, autres en-têtes.

## Tests

- Intégration : les en-têtes d'une page ; un rapport enregistré et compté ; une lecture réservée à l'administratrice.
