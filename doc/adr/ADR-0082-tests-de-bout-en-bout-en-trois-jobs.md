---
id: ADR-0082
titre: Tests de bout en bout répartis sur trois jobs de la CI
statut: accepté
date: 2026-11-10
liens: [ADR-0059-ci-en-jobs-paralleles.md, ADR-0023-deploiement-sans-ci-redondante.md, ADR-0079-tests-de-chaque-developpement.md]
---

# ADR-0082 : Tests de bout en bout répartis sur trois jobs de la CI

## Contexte

Depuis l'EPIC-050 et ADR-0079, la suite Playwright compte plus de 220 tests. Sur la CI de la PR #202, le 2026-11-10 :

- le job `e2e` dure 8 min 50, dont 7 min 10 pour `npm run test:e2e` ; c'est la plus longue étape de la CI, qui en dure 10 min 30 ;
- la somme des durées des tests vaut environ 21 minutes, partagées entre trois navigateurs (ADR-0059), occupés en continu : 21 / 3 ≈ 7 minutes.

Les navigateurs sont déjà pleins : lancer en parallèle les tests d'un même fichier ne gagnerait rien. Un quatrième navigateur sur la même machine (4 processeurs, partagés avec le serveur de Limbus et PostgreSQL) rendrait les tests instables. Le dépôt est public : les minutes de GitHub Actions ne coûtent rien.

## Décision

- Le job `e2e` devient une matrice de trois jobs (`shard: [1, 2, 3]`, `fail-fast: false`). Chacun lance `npm run test:e2e -- --shard=<n>/3` : Playwright lui donne un tiers des fichiers de tests, que ses trois navigateurs se partagent comme avant.
- Chaque job a sa base PostgreSQL, son serveur et son faux serveur d'emails : le découpage ne change rien aux règles des tests (ADR-0037, ADR-0059).
- `check` attend les trois jobs ; « Verdict CI » reste la seule vérification exigée.
- Les traces d'un échec sont archivées par job (`playwright-traces-<n>`).

## Conséquences

- L'étape Playwright passe d'environ 7 minutes à environ 2 min 30, plus la minute de préparation de chaque job (conteneur, dépendances, Chromium). La CI d'une PR de code descend vers 6 minutes.
- Playwright répartit les fichiers par nombre de tests, et non par durée : un tiers peut durer plus que les autres. Si l'écart grandit, découper les plus gros fichiers (`writingLists`, `writing`, `registrationRules`, `registration`).
- Un test qui dépend de l'ordre des fichiers, ou de données laissées par un autre fichier, échouera selon son tiers : la règle « chaque test crée ses données » (ADR-0079) l'interdit déjà.
- En local, rien ne change : `npm run test:e2e` lance toujours toute la suite.

## Options écartées

- **Tests d'un même fichier en parallèle (`fullyParallel`)** : les trois navigateurs sont déjà occupés en continu.
- **Plus de navigateurs sur une machine** : 4 processeurs pour le serveur, la base et les navigateurs ; les délais des assertions sauteraient.
- **Accélérer chaque test** (connexion, attentes de `networkidle`) : utile, mais à reprendre test par test, pour un gain moindre ; à faire au fil des fichiers touchés.
