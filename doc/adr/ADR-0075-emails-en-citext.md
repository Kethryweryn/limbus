---
id: ADR-0075
titre: Les adresses email sont comparées sans tenir compte de la casse par le type citext
statut: proposé
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../epics/EPIC-049-schema-de-donnees/US-192-emails-sans-casse.md]
---

# ADR-0075 : Les adresses email sont comparées sans tenir compte de la casse par le type citext

## Contexte

L'unicité de `User.email` dépend de la mise en minuscules faite par le code (schémas zod de `server/utils/schemas.ts`), et les rapprochements par email (`participantEmailMatchWhere`) demandent `mode: 'insensitive'` à chaque requête ([revue du schéma](../archive/todo/schema-de-donnees.md), § 3). Rien n'empêche une écriture qui oublierait la mise en minuscules de créer un doublon.

## Décision

- L'extension PostgreSQL `citext` est activée par migration (`CREATE EXTENSION IF NOT EXISTS citext`). Elle est marquée « de confiance » depuis PostgreSQL 13 : la propriétaire de la base peut la créer sans droits d'administration du serveur.
- Les colonnes d'adresse comparées entre elles passent en `@db.Citext` : `User.email`, `Participant.email`, `Registration.email`, `RegistrationRequest.email`, `GameInvitation.email`, `AccountToken.email`.
- Le code garde la mise en minuscules à l'écriture, pour l'affichage ; les `mode: 'insensitive'` deviennent inutiles et sont retirés.

## Conséquences

- La contrainte d'unicité de `User.email` refuse « Lea@x.fr » à côté de « lea@x.fr ».
- Passer de `text` à `citext` est un changement de type : migration marquée incompatible. Le build d'avant écrit du texte, que PostgreSQL convertit en `citext` ; à vérifier sur une copie.
- La migration échoue si deux comptes ne diffèrent que par la casse : vérifié d'abord en production.
- Reste à vérifier la déclaration de l'extension dans le schéma Prisma 7 (`extensions` de la source de données).

## Options écartées

- **Index sur `lower(email)`** : Prisma ne décrit pas les index sur une expression ; il faudrait vérifier qu'une migration générée ne le retire pas.
- **Un test seul** : recommandé dans la revue ; écarté par l'utilisatrice, qui veut que la base l'impose.
