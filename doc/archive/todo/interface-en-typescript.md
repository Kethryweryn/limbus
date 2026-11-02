---
titre: Passer l'interface en TypeScript
statut: archivée
date: 2026-10-29
revue: ../../revues/2026-10-29-architecture.md
---

# Passer l'interface en TypeScript

## Besoin

58 composants et pages sur 60 sont en `<script setup>` JavaScript (revue d'architecture, R-10). `npm run typecheck` ne vérifie donc que le serveur et les utilitaires. Quand une réponse d'API change de forme, l'interface compile toujours, et l'erreur n'apparaît qu'à l'usage.

## Proposition

Un chantier dédié qui passe tous les composants en `lang="ts"`, avec des types pour les réponses d'API. Ces types sont partagés avec le serveur, ou déduits des routes Nitro (`$fetch` typé). Une fois le chantier fini, la CI échoue si un composant n'est pas en TypeScript.

## Découpage envisagé

1. Types des réponses d'API et `useApiFetch` typé.
2. Composants partagés (`components/`).
3. Pages, en découpant au passage les plus volumineuses : `timeline/index.vue` (670 lignes), `sessions/index.vue` (494).
4. Règle de lint ou de CI qui exige `lang="ts"`.

## Suivi

- 2026-11-02 : choix de l'utilisatrice : réponses déduites des routes, strict dès le départ, une PR par domaine, gros écrans découpés. [EPIC-031](../epics/EPIC-031-interface-en-typescript/README.md), [ADR-0057](../../adr/ADR-0057-interface-en-typescript.md) ; lot 1 (fondations) fait.
- 2026-11-02 : lots 2 à 5 faits (US-115 à US-118) : toute l’interface est en TypeScript strict, et la règle de lint couvre tous les `.vue`. EPIC-031 terminé.

## Points à trancher

- Types partagés écrits à la main, ou inférés des routes Nitro ? Recommandation : inférés quand c'est possible, pour ne pas les maintenir deux fois.
- Le mode strict de TypeScript dès le départ, ou progressivement ?
- Une PR par lot, ou par groupe de pages (écriture, sessions, inscriptions) ?
