---
id: EPIC-027
titre: Durcissement web : origine des écritures, cookie __Host-, CSP en mode rapport
statut: terminé
spec: ../../../todo/durcissement-web.md
date: 2026-11-01
---

# EPIC-027 : Durcissement web

## Objectif

Étape 5 de la [feuille de route](../../../feuille-de-route.md), chantier 2 ([fiche](../../../todo/durcissement-web.md)) : appliquer les recommandations R-01 à R-03 de la revue d'architecture du 29 octobre 2026.

## Décisions

- Une écriture (POST, PUT, PATCH, DELETE) venue d'un autre site est refusée, de même qu'une écriture sans aucun indice d'origine.
- Le cookie de connexion prend le préfixe `__Host-` : tout le monde est déconnecté une fois.
- La CSP est posée par l'application, avec Nuxt Security, d'abord en mode rapport :
  - les violations sont comptées en base, et l'administratrice peut les lire ;
  - elle sera appliquée dans une PR à part, après une semaine sans violation inattendue.

## US

| US | Titre | Statut |
|---|---|---|
| [US-104](US-104-origine-des-ecritures.md) | Refuser les écritures venues d'un autre site | terminée |
| [US-105](US-105-cookie-host.md) | Cookies avec le préfixe __Host- | terminée |
| [US-106](US-106-csp-en-mode-rapport.md) | CSP et COOP sur les pages, d'abord en mode rapport | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0053](../../../adr/ADR-0053-durcissement-web.md).
