---
id: ADR-0015
titre: Trois niveaux de tests, contre l'application compilée et une base jetable
statut: accepté
date: 2026-10-27
liens: [ADR-0002, ADR-0007]
---

# ADR-0015 : Trois niveaux de tests, contre l'application compilée et une base jetable

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

Le projet n'avait pas de tests. Le déploiement automatique ([ADR-0002](ADR-0002-deploiement-continu.md)) n'est sûr que si la CI attrape les régressions, en particulier sur les droits d'accès.

## Décision

- **Unitaires** (Vitest, `tests/`) : logique pure et utilitaires serveur. `tests/setup.ts` recrée les auto-imports Nitro (`createError`, `getHeader`, `useRuntimeConfig`…) et remplace Prisma par un objet vide, auquel chaque test assigne les méthodes dont il a besoin. `h3` est fixé en v1 pour correspondre à Nitro.
- **Intégration** (`tests/integration/`) : l'application compilée (`.output`) tourne contre une base PostgreSQL jetable. Le nom de la base doit contenir « test », car elle est vidée. Scénario de référence : deux organisatrices, Alice et Bob, et une co-organisatrice ; Alice ne doit rien atteindre du jeu de Bob, avec un témoin positif à chaque fois ([ADR-0007](ADR-0007-isolation-par-jeu.md)).
- **Bout en bout** (Playwright, Chromium, `tests/e2e/`) : connexion, déconnexion avec effacement des données de l'appareil, 403, page publique. Les tests attendent `networkidle` avant de remplir un formulaire : avant l'hydratation, un clic soumet le formulaire nativement.
- En CI, les trois niveaux tournent avec un service PostgreSQL 15 ; les traces Playwright sont conservées 7 jours en cas d'échec.
- Sous Windows, le build échoue au prérendu : l'intégration et le bout en bout se lancent dans des conteneurs Linux (`node:24`, et `mcr.microsoft.com/playwright:v<version>-noble` à la version de `@playwright/test`).

## Conséquences

- Les tests d'intégration vérifient le vrai serveur (routage Nitro, cookies, migrations), pas une simulation.
- Une CI complète prend quelques minutes, à cause du build.
- Chaque nouvelle route liée à un jeu doit être ajoutée au test d'isolation.

## Options écartées

- **Tests d'intégration contre le serveur de développement** : comportement différent du build de production (prérendu, chemins).
- **Base SQLite pour les tests** : écarts de comportement avec PostgreSQL (contraintes, types, cascades).
