---
id: ADR-0067
titre: Tests liés au changement joués en local avant chaque push de code
statut: accepté
date: 2026-11-06
liens: [ADR-0023]
---

# ADR-0067 : Tests liés au changement joués en local avant chaque push de code

## Contexte

ADR-0023, point 8, retire le build local : lint, typecheck et tests unitaires suffisent, la CI fait le reste. Le but était d'éviter de construire et de tester trois fois.

Sur la PR #152, un test de bout en bout a échoué en CI : la page d'erreur ajoutée ne s'affichait jamais. L'échec aurait été vu avant le push si ce test avait été joué. L'utilisatrice demande que chaque changement soit vérifié par tous les tests qui lui sont liés.

## Décision

Avant chaque push de code, correction de revue comprise :

1. `npm run lint`, `npm run typecheck` et `npm test` passent, et leur résultat est lu.
2. Les tests liés au changement passent : relever les écrans, routes et utilitaires touchés, puis jouer les fichiers Playwright et d'intégration qui les couvrent, pas seulement les tests ajoutés. Sous Windows, cela passe par le conteneur Linux.
3. Si ces tests ne peuvent pas tourner, le dire et demander avant de pousser.

Une PR de documentation seule vérifie ses liens. La suite complète reste à la CI de la PR. Ce point remplace le point 8 d'ADR-0023 ; le reste de cet ADR ne change pas.

## Conséquences

- Un défaut lié au changement se voit avant la PR, en quelques minutes.
- Un build local revient pour les changements de code, mais pas la suite entière.
- Le choix des tests liés reste un jugement : la CI rattrape ce qui a été oublié.

## Options écartées

- **Garder ADR-0023 tel quel** : c'est lui qui a laissé passer la PR #152.
- **Rejouer toute la suite en local** : la CI le fait déjà, et c'est la lenteur qu'ADR-0023 voulait retirer.
