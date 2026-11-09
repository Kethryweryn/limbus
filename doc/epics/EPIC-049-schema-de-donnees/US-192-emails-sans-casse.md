---
id: US-192
titre: Comparer les adresses email sans tenir compte de la casse dans la base
statut: terminée
epic: EPIC-049
regles: []
adr: [ADR-0075]
---

# US-192 : Comparer les adresses email sans tenir compte de la casse dans la base

En tant que mainteneuse de Limbus, je veux que la base compare les adresses sans tenir compte des majuscules, afin qu'une écriture qui oublierait la mise en minuscules ne crée pas de doublon.

## Critères d'acceptation

- [x] L'extension `citext` est activée par migration.
- [x] Les colonnes d'adresse listées dans ADR-0075 sont en `citext` ; « Lea@x.fr » et « lea@x.fr » sont la même adresse pour la base.
- [x] Les `mode: 'insensitive'` sur ces colonnes sont retirés.
- [x] Avant la migration, aucun doublon ne diffère que par la casse en production.

## Notes techniques

- Production relevée le 2026-11-09 : `citext` disponible et marquée « de confiance », base propriété du rôle de l'application, aucune adresse en majuscules ni compte en double par la casse.
- Prisma 7 accepte `@db.Citext` sans déclarer l'extension dans la source de données : la migration la crée (`CREATE EXTENSION IF NOT EXISTS citext`), et `migrate diff` ne propose ni de la retirer ni de la recréer.
- Vérifié avec le client Prisma du build d'avant sur une base migrée : lecture, connexion par `findUnique`, doublon par la casse refusé, rapprochement et rattachement en mode insensible.
- Le code garde la mise en minuscules à l'écriture et retire ses espaces avant de comparer : citext ignore la casse, pas les espaces. Les deux `mode: 'insensitive'` sur une adresse sont retirés ; ceux des recherches par nom restent.
- La fiche [Un compte pour chaque participant](../../todo/compte-pour-chaque-participant.md) n'est pas encore spécifiée : rien à coordonner pour l'instant.

ADR :
- [ADR-0075](../../adr/ADR-0075-emails-en-citext.md)

## Tests

Intégration : `tests/integration/schema.test.ts` (les six colonnes en citext ; un compte en double par la casse refusé, retrouvé quelle que soit la casse, adresse gardée telle qu'écrite) ; `tests/integration/participations.test.ts` (une fiche en capitales est rattachée au compte confirmé) ; suite complète. Bout en bout : suite complète.
