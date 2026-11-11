---
titre: Un déploiement rapide quand les dépendances changent
statut: prête
date: 2026-11-11
---

# Un déploiement rapide quand les dépendances changent

## Besoin

Fusionner une PR la met en production ([ADR-0023](../adr/ADR-0023-deploiement-sans-ci-redondante.md)). Le serveur reçoit le build testé par la CI, mais il garde ses propres dépendances (`node_modules`), qui servent au client Prisma, aux migrations et aux scripts (`npm run user:create`…).

Quand `package-lock.json` et Node n'ont pas changé, `deploy.sh` reprend les dépendances en place par liens physiques : le déploiement prend quelques secondes. Sinon, il lance un `npm ci --include=dev` complet. C'est le cas de chaque PR de dépendances, donc de la PR groupée de Dependabot chaque lundi.

Le 2026-11-11, PR #221 (nodemailer, eslint, vue-tsc) : l'étape « Déployer le build » a pris 6 min 54 s, dont `added 1344 packages, and audited 1346 packages in 6m`. Avec la CI de la PR (5 min 48 s), il a fallu environ 13 minutes entre la fusion demandée et la production.

À la rédaction d'ADR-0023, le même `npm ci` prenait 52 s sur ce serveur. On ne sait pas encore pourquoi il est passé à 6 minutes : réseau, cache npm vidé, charge du serveur partagé, modules natifs recompilés (`bcrypt`), `nuxt prepare` en fin d'installation.

## Proposition

Rendre le déploiement d'une PR de dépendances aussi proche que possible de celui d'une PR de code, sans perdre ce qu'apporte ADR-0023 : on déploie exactement ce qui a été testé, et un déploiement refusé laisse le serveur dans son état.

Pistes, à comparer après la mesure :

1. **Corriger la régression** : si la mesure montre une cause précise (cache npm absent, recompilation, réseau), la traiter, et revenir vers la minute d'ADR-0023 sans changer le principe.
2. **Envoyer les dépendances avec le build** : la CI construit déjà dans un conteneur Debian 12 + Node 24 comme le serveur. L'archive porterait aussi `node_modules` et le client Prisma, et le serveur n'installerait plus rien. L'archive grossit (la limite actuelle est de 200 Mo) et son envoi prend plus de temps.
3. **Installer seulement ce qui sert au serveur** : le build (`.output`) porte déjà ce dont l'application a besoin pour tourner. Le serveur n'aurait besoin que de Prisma (client et migrations) et des scripts, sans les outils de build et de test (eslint, vue-tsc, Playwright, vitest…).

## Découpage envisagé

1. Mesurer, étape par étape, un déploiement avec dépendances changées (réseau, extraction, scripts d'installation, `nuxt prepare`) et le comparer aux 52 s d'ADR-0023.
2. Appliquer la piste retenue, avec un ADR qui complète ADR-0023.

## Décisions

- 2026-11-11, mesure : sur le prochain déploiement de dépendances, sans lancer de déploiement exprès. `deploy.sh` note l'heure de chaque étape et `npm ci --timing` la durée de chaque phase.
- 2026-11-11, objectif : revenir autour d'une minute, le niveau d'ADR-0023.
- 2026-11-11, piste : choisie après la mesure ; si la cause est simple, la corriger suffit.

## Points à trancher

Aucun pour la mesure. La piste se tranche avec les chiffres du prochain déploiement de dépendances.
