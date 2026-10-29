---
titre: Nettoyages techniques issus de la revue d'architecture
statut: prête
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Nettoyages techniques issus de la revue d'architecture

## Besoin

La [revue d'architecture](../revues/2026-10-29-architecture.md) relève trois petits écarts. Aucun ne change le comportement de l'application :

- R-07 : deux requêtes en base dans des boucles (motif N+1) : `server/utils/documents.ts`, une recherche par destinataire, et `server/utils/trombinoscopes.ts`, un `upsert` par entrée ;
- R-11 : 61 routes répètent la lecture d'un paramètre d'URL et l'erreur 400 qui va avec ;
- R-12 : des outils de build (`eslint`, `@nuxt/eslint`, `typescript`, `nuxi`, `workbox-build`, `@vite-pwa/assets-generator`) sont dans `dependencies` au lieu de `devDependencies`.

## Proposition

- **R-07** : une seule requête avec un filtre `in` pour les destinataires. Les `upsert` sont regroupés en une transaction, ou remplacés par une suppression suivie d'un `createMany`.
- **R-11** : un utilitaire `requireRouterParam(event, 'id')` dans `server/utils/`, adopté dans toutes les routes en une passe mécanique.
- **R-12** : déplacer les paquets et vérifier que la CI (build, tests) et `deploy.sh` les installent toujours.

## Découpage envisagé

Une PR `fix/…` par point, dans l'ordre R-12, R-07, R-11. Chacune passe la CI complète. Ces nettoyages ne changent pas le comportement : ils ne demandent ni spec ni US, et chaque PR cite cette fiche et le numéro de recommandation, comme le permet l'exception de CLAUDE.md pour les correctifs sans changement de comportement.

## Décisions

- 2026-10-29 : pas de spec : ces nettoyages ne changent pas le comportement. La fiche est archivée quand les trois PR sont fusionnées.
