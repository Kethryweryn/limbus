---
id: ADR-0016
titre: Mises à jour des dépendances par Dependabot, avec délai et majeures bloquées ignorées
statut: accepté
date: 2026-10-27
liens: [ADR-0002]
---

# ADR-0016 : Mises à jour des dépendances par Dependabot

*Rédigé a posteriori, pour la configuration `.github/dependabot.yml` du 2026-10-27.*

## Contexte

Les dépendances n'étaient pas suivies. Fusionner une PR de mise à jour la déploie en production ([ADR-0002](ADR-0002-deploiement-continu.md)). Une version piégée (paquet compromis) est en général retirée du registre en quelques jours.

## Décision

- **npm** : chaque lundi à 06:00 (Europe/Paris).
  - Une PR groupée pour les versions mineures et correctifs (`mineures-et-correctifs`), et une PR par version majeure, à lire avant de fusionner.
  - **Délai de 7 jours** (`cooldown`) avant de proposer une nouvelle version.
  - 10 PR ouvertes au plus. Avec la limite par défaut de 5, les PR de versions majeures bloquaient la PR groupée.
- **GitHub Actions** : chaque mois, en une PR groupée.
- La CI valide chaque PR ; on fusionne en squash.
- **Majeures ignorées**, parce qu'elles dépendent d'une autre dépendance qui n'a pas encore suivi :
  - `h3` : fixé en v1 pour correspondre à Nitro ;
  - `typescript` : typescript-eslint 8 exige une version inférieure à 6.1 ;
  - `@vite-pwa/assets-generator` : `@vite-pwa/nuxt` 1.1 exigeait la version 1 (exclusion retirée le 2026-11-23 : `@vite-pwa/nuxt` 2 accepte la version 2) ;
  - `pinia` et `@pinia/nuxt` : chaque version de l'un exige une majeure précise de l'autre. Une PR qui n'en monte qu'un échoue, on les monte donc ensemble à la main.
- Le motif de chaque exclusion est écrit en commentaire dans le fichier ; une exclusion se retire quand le blocage disparaît.

## Note du 2026-11-20

Quand un avis grave vise un paquet qu'une dépendance épingle à une version exacte, et qu'une version corrigée existe dans la même majeure, on force cette version par `overrides` dans `package.json`, sans attendre la dépendance. Premier cas : `effect` (avis [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw), corrigé en 3.22.1), que `@prisma/config` épingle en 3.20.0. `effect` ne sert qu'à l'outil Prisma en ligne de commande : il n'est pas dans le serveur en service, mais le déploiement lance cet outil sur le serveur (`prisma generate`, `prisma migrate deploy`) ; les tests d'intégration de la CI jouent les migrations avec la version forcée. Le forçage de `@hono/node-server`, plus ancien, suit la même forme. Un forçage se retire quand la dépendance demande elle-même une version corrigée. L'exemption d'[ADR-0094](ADR-0094-exemptions-de-l-audit.md) reste réservée aux avis sans version corrigée.

## Conséquences

- Les correctifs de sécurité arrivent avec 7 jours de retard ; `npm audit` en CI signale entre-temps les vulnérabilités graves des dépendances de production. Depuis [ADR-0094](ADR-0094-exemptions-de-l-audit.md), un avis sans correctif qui ne touche pas le serveur en service peut en être exempté, nommément.
- Les majeures ignorées doivent être revérifiées de temps en temps, puisque Dependabot ne les propose plus.

## Options écartées

- **Renovate** : plus souple (fusion automatique, groupes liés), mais une application de plus à installer et configurer.
- **Fusion automatique des correctifs** : chaque fusion est un déploiement ; on garde un regard humain.
