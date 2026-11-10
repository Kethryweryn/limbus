---
id: ADR-0059
titre: CI en jobs parallèles, dépendances en cache, Playwright sur trois navigateurs
statut: accepté, job `e2e` découpé en trois par ADR-0082
date: 2026-11-03
liens: [ADR-0023-deploiement-sans-ci-redondante.md, ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md, ADR-0015-strategie-de-tests.md]
---

# ADR-0059 : CI en jobs parallèles, dépendances en cache, Playwright sur trois navigateurs

## Contexte

La CI d'une PR de code durait 7 min 51 s (lot 2 de SPEC-014, PR #112), presque tout dans le seul job `check` d'[ADR-0023](ADR-0023-deploiement-sans-ci-redondante.md), qui enchaînait :

| Étape | Durée |
|---|---|
| Conteneurs (Debian 12 + Node 24, PostgreSQL) | 30 s |
| `npm ci` | 58 s |
| Lint, typecheck, unitaires | 48 s |
| Build | 43 s |
| Intégration | 45 s |
| Installation de Chromium | 20 s |
| Playwright, un seul navigateur | 178 s |
| Archive | 12 s |

Les étapes ne dépendent pas toutes les unes des autres : les contrôles statiques ne lisent pas le build, et l'intégration et Playwright ne se lisent pas l'un l'autre.

Playwright tournait sur un seul navigateur parce que l'application n'a qu'un réglage SMTP : chaque test qui envoie un email démarrait son propre faux serveur et l'inscrivait dans ce réglage. À plusieurs navigateurs, les tests se volaient les emails (essai local : 8 échecs).

## Décision

1. **Jobs parallèles** : le job `check` d'ADR-0023 se découpe.
   - `static` (lint, typecheck, unitaires, audit) et `build` démarrent ensemble.
   - `integration` et `e2e` testent le build dès qu'il est prêt, en parallèle. Ils le reçoivent en artefact de travail (`build-a-tester`, gardé un jour).
   - `check` ne tourne que si les trois réussissent, et archive alors ce build sous le nom que le déploiement cherche (`limbus-build`). Le reste d'ADR-0023 ne change pas : verdict unique, déploiement du build testé, documentation seule.
2. **`node_modules` en cache** (`.github/actions/dependances`), clé `package-lock.json`, construit dans le même conteneur que les tests : ses modules natifs y sont compilés. Un cache trouvé saute `npm ci` : restent `nuxt prepare` (le `tsconfig.json` de la racine étend celui de `.nuxt`) et `prisma generate`. Sans lui, `npm ci` repart du cache `~/.npm`. Chromium est aussi en cache, par version de Playwright.
3. **Un faux serveur SMTP pour toute la série Playwright** (`tests/e2e/mailbox.ts`), démarré par `globalSetup.ts`. Il écrit les emails dans un fichier, que chaque test lit depuis son processus. Un test ouvre sa boîte (`openMailbox`), qui ne voit que les emails arrivés depuis, par destinataire.
4. **Trois navigateurs** : les fichiers de tests se répartissent entre trois workers ; les tests d'un fichier se suivent. En plus de la règle d'[ADR-0037](ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md) (chaque test crée sa session dans le jeu commun), un test qui attend un email l'adresse à une personne qui lui est propre (`parcoursPerson`), jamais à un participant partagé du jeu commun.

## Conséquences

- Un test e2e qui change un réglage global de l'application (SMTP, inscription libre…) gênerait les autres : il faudrait alors le mettre dans un projet Playwright à part, lancé après les autres. Aucun test ne le fait aujourd'hui (celui de l'administration lit le réglage SMTP et envoie un test, sans l'enregistrer).
- Chaque job paie le démarrage de son conteneur et la restauration du cache, mais le chemin le plus long n'est plus que build puis Playwright.
- Une mise à jour des dépendances (Dependabot) change la clé : sa première CI refait `npm ci`.

## Options écartées

- **Découper Playwright en plusieurs jobs (shards)** : chaque job repaie conteneurs, cache et Chromium ; trois workers dans un job suffisent pour l'instant.
- **Archiver le build dès le job `build`** : le déploiement ne retient que les CI réussies, mais l'archive d'un build qui a échoué existerait quand même. ADR-0023 veut qu'elle n'existe que s'il a tout passé.
- **Garder un faux serveur par test** et passer le port par en-tête : il faudrait un mode de test dans l'application.
