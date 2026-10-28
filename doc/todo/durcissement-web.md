---
titre: Durcissement web : CSP, origine des requêtes, cookie de session
statut: à trancher
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Durcissement web : CSP, origine des requêtes, cookie de session

## Besoin

La [revue d'architecture du 29 octobre 2026](../revues/2026-10-29-architecture.md) relève trois écarts avec les recommandations de l'OWASP :

- R-01 : pas de Content-Security-Policy ni de `Cross-Origin-Opener-Policy` sur les pages de l'application ;
- R-02 : les écritures ne vérifient pas l'origine de la requête ; seul `SameSite=Lax` protège contre le CSRF ;
- R-03 : le cookie de session n'a pas le préfixe `__Host-`.

## Proposition

- **R-01** : CSP stricte avec un nonce par réponse et `strict-dynamic`, et `Cross-Origin-Opener-Policy: same-origin`. Elles sont posées par l'application (module Nuxt Security ou `routeRules`), donc pour Limbus seul. ADR-0003, qui écarte une CSP globale à Apache, reste valable.
- **R-02** : un middleware serveur refuse les requêtes qui modifient des données (POST, PUT, PATCH, DELETE) quand `Sec-Fetch-Site` vaut `cross-site`. Si l'en-tête manque, il compare `Origin`, ou à défaut `Referer`, à `PUBLIC_APP_URL`. Les routes publiques sont incluses : le lien personnel d'inscription est ouvert depuis un email, mais ses écritures partent de la page elle-même.
- **R-03** : le cookie `limbus_token` devient `__Host-limbus_token`. Tout le monde est déconnecté une fois, et l'effacement des données hors ligne suit la règle habituelle.

## Découpage envisagé

1. R-02 et R-03, petits et indépendants.
2. R-01, plus délicat : il faut recenser ce que la CSP doit autoriser (scripts de Nuxt et du service worker PWA, styles de Nuxt UI, iframes YouTube, images externes des fiches), puis la tester d'abord en mode « report-only ».

## Points à trancher

- Nuxt Security (module tiers maintenu, nonce géré) ou en-têtes écrits à la main dans `routeRules` / un plugin Nitro ? Recommandation : Nuxt Security, pour le nonce en SSR.
- Une période en `Content-Security-Policy-Report-Only` avant d'appliquer la CSP ? Recommandation : oui, une semaine, avec les violations journalisées par une route dédiée.
- R-02 : faut-il refuser une écriture sans `Sec-Fetch-Site`, `Origin` ni `Referer` (vieux navigateur, outil en ligne de commande) ? Recommandation : oui, sans exception, connexion comprise : une connexion forcée depuis un autre site (« login CSRF ») ferait travailler la victime dans un compte de l'attaquant. Une future [API pour une IA](api-pour-ia.md) s'authentifiera par jeton, et non par cookie : elle n'aura pas besoin d'exception.
