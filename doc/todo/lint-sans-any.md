---
titre: Aucun any dans le code, règle de lint en erreur partout
statut: prête
date: 2026-11-03
---

# Aucun `any` dans le code, règle de lint en erreur partout

## Besoin

Le passage de l'interface en TypeScript strict (EPIC-031, ADR-0057) n'a couvert que les `.vue`, les composables et quelques fichiers de `utils/`. Ailleurs, la règle `@typescript-eslint/no-explicit-any` n'est qu'un avertissement. Le 3 novembre 2026, `npm run lint` en compte 117, tous de cette règle, dans 31 fichiers :

- 17 fichiers de tests d'intégration ;
- 9 fichiers serveur (`server/utils`, `server/api`), dont `concurrency.ts`, `gameAccess.ts`, `gameCopy.ts` et les écritures de `contentWrites.ts` ;
- 4 fichiers de `utils/` (stockage, file hors ligne, connexion) et 1 test unitaire ;
- `scripts/create-user.ts`.

Un `any` désactive la vérification de types à cet endroit. Une route dont la réponse change, ou un champ renommé dans Prisma, n'y est donc pas signalé. Et tant que la règle n'est qu'un avertissement, de nouveaux `any` peuvent entrer sans bloquer la CI.

## Proposition

- Remplacer chaque `any` par le vrai type : types Prisma générés, `H3Event`, types déduits des routes (`ApiResponse`), `unknown` suivi d'une vérification quand la valeur vient de l'extérieur.
- Passer `@typescript-eslint/no-explicit-any` en erreur pour tout le dépôt, tests et scripts compris. `TYPED_INTERFACE` ne sert alors plus que pour la règle `vue/block-lang`.
- Un `any` qui resterait justifié (par exemple l'accès générique à un modèle Prisma par son nom) se commente sur sa ligne, avec la raison : `eslint-disable-next-line`.

C'est un nettoyage sans changement de comportement. Il n'a pas d'US et cite cette fiche (CLAUDE.md).

## Découpage envisagé

1. Serveur et `utils/` : une PR.
2. Tests, scripts, puis règle en erreur partout : une PR.

## Points à trancher

Aucun : demandé par l'utilisatrice le 3 novembre 2026.
