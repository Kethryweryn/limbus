---
id: ADR-0053
titre: Origine vérifiée sur les écritures, cookies __Host-, CSP par Nuxt Security en mode rapport
statut: remplacé en partie par ADR-0091
date: 2026-11-01
liens: [../todo/durcissement-web.md, ../revues/2026-10-29-architecture.md, ADR-0003-service-de-production.md]
---

# ADR-0053 : Origine vérifiée sur les écritures, cookies __Host-, CSP par Nuxt Security en mode rapport

## Contexte

La revue d'architecture du 29 octobre 2026 recommande trois mesures de l'OWASP :

- R-01 : une CSP et une COOP sur les pages ;
- R-02 : vérifier l'origine des écritures ;
- R-03 : le préfixe `__Host-` sur le cookie de session.

ADR-0003 écarte une CSP posée par Apache, qui toucherait les autres sites du serveur. Une CSP posée par l'application ne touche que Limbus.

## Décision

- **R-02, origine** : un middleware serveur (`server/middleware/origin.ts`) traite chaque POST, PUT, PATCH et DELETE sous `/api/`.
  - Si `Sec-Fetch-Site` est présent, seuls `same-origin` et `none` passent. `none` correspond à une action de l'utilisateur sans page d'origine.
  - Sinon, l'origine de `Origin`, ou à défaut de `Referer`, doit être celle de `PUBLIC_APP_URL`.
  - Sans aucun des trois, la requête est refusée (403). Cela vaut aussi pour la connexion, contre la connexion forcée (« login CSRF »).
  - Seule exception : `POST /api/public/csp-report`. Le navigateur l'envoie de lui-même, et elle n'écrit qu'un compteur.
- **R-03, cookies** : `__Host-limbus_token` et `__Host-limbus_admin_mode`, `Secure`, sur `/`, sans `Domain`. L'ancien nom n'est plus lu. Tout le monde est donc déconnecté une fois ; les données hors ligne suivent la règle habituelle (ADR-0036).
- **R-01, CSP** : module Nuxt Security, qui gère le nonce par réponse en rendu serveur.
  - Politique :
    - `default-src 'self'` ;
    - `script-src 'self' 'nonce-…' 'strict-dynamic'` et `script-src-attr 'none'` ;
    - `style-src 'self' 'unsafe-inline'`, pour les styles de Nuxt UI ;
    - `img-src 'self' data: blob: https:`, pour les images externes des fiches ;
    - `font-src 'self' data:` ;
    - `connect-src 'self'`, `worker-src 'self'`, `manifest-src 'self'` ;
    - `frame-src https://www.youtube.com` ;
    - `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'self'` ;
    - `report-uri /api/public/csp-report`.
  - Elle part d'abord en `Content-Security-Policy-Report-Only`. Les rapports sont comptés dans `CspViolation` (directive, ressource bloquée, page), sans adresse IP ni compte. L'administratrice les lit par `GET /api/admin/csp-reports`. Après une semaine sans violation inattendue, une PR passe la CSP en mode bloquant.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - Le reste du module est désactivé, pour ne pas changer le comportement de Limbus : les autres en-têtes, les limites de débit et de taille, le filtre XSS, le CORS, les méthodes autorisées et le retrait des `console`. HSTS reste du ressort d'Apache.

## Conséquences

- Un outil en ligne de commande ou un script qui écrit dans l'API doit envoyer `Origin`. Une future API pour une IA s'authentifiera par jeton, sans cookie, avec sa propre règle.
- Les tests d'intégration envoient `Sec-Fetch-Site: same-origin`, comme un navigateur.
- Une page prérendue (`/`) n'a pas de nonce : elle reçoit sa CSP par les en-têtes de Nitro, et ses scripts sont autorisés par empreinte.

## Options écartées

- **En-têtes écrits à la main** : il faudrait ajouter le nonce à chaque balise `<script>` que rend Nuxt, ce que le module fait déjà.
- **CSP bloquante dès le premier jour** : une ressource oubliée (icônes, polices, service worker) casserait des pages en production.
- **Jeton anti-CSRF** : selon l'OWASP, `SameSite=Lax` et la vérification de l'origine suffisent, sans toucher à chaque formulaire.
