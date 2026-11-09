---
id: ADR-0076
titre: Les dates sont stockées avec leur fuseau horaire (timestamptz)
statut: accepté
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../epics/EPIC-049-schema-de-donnees/US-194-dates-avec-fuseau.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0076 : Les dates sont stockées avec leur fuseau horaire (timestamptz)

## Contexte

Prisma crée les colonnes `DateTime` en `timestamp(3)`, sans fuseau ; aucune migration n'utilise `timestamptz`. Prisma écrit et lit en UTC, donc rien n'est faux aujourd'hui, mais un `now()` ou une comparaison dans du SQL écrit à la main dépend du fuseau de la session PostgreSQL ([revue du schéma](../archive/todo/schema-de-donnees.md), § 4). La documentation de PostgreSQL recommande `timestamptz`.

## Décision

- Toutes les colonnes `DateTime` passent en `@db.Timestamptz(3)`.
- La migration convertit chaque colonne en lisant l'existant comme de l'UTC : `ALTER COLUMN … TYPE timestamptz(3) USING … AT TIME ZONE 'UTC'`.
- Les connexions de Prisma ouvrent leur session en UTC (`-c TimeZone=UTC`, `server/utils/databaseConnection.ts`), quel que soit le fuseau de la base. L'adaptateur pg de Prisma 7 échange les dates sans fuseau, que PostgreSQL lit dans celui de la session : sur une colonne `timestamptz`, une base en Europe/Paris, comme la production, décale chaque instant d'une à deux heures ([prisma/orm#26786](https://github.com/prisma/orm/issues/26786), [prisma/orm#28629](https://github.com/prisma/orm/issues/28629) ; vérifié à l'implémentation).
- Deux déploiements (choix de l'utilisatrice) : d'abord le réglage de la connexion, sans effet sur les colonnes `timestamp` actuelles, puis la conversion, que le build en service lit et écrit alors correctement.
- C'est le dernier lot de [EPIC-049](../epics/EPIC-049-schema-de-donnees/README.md). Avant lui, une copie de la base de production est convertie et le build en service y est joué : il doit lire et écrire les mêmes instants.

## Conséquences

- Un instant garde son sens quel que soit le fuseau du serveur ou d'un outil SQL.
- La migration réécrit chaque table qui a une date : marquée incompatible ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)), courte avec les volumes actuels.
- Toute nouvelle colonne de date déclare `@db.Timestamptz(3)` ; un test d'intégration le vérifie sur le schéma.
- Toute connexion Prisma passe par `pgAdapterOptions` : sans elle, les dates seraient décalées. Un test le vérifie sur une base réglée sur Europe/Paris.

## Options écartées

- **Garder `timestamp` sans fuseau** : juste tant que tout passe par Prisma, mais fragile pour le SQL écrit à la main.
