---
id: ADR-0074
titre: Les liens entre éléments d'un jeu passent par des clés étrangères composées avec le jeu
statut: proposé
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../epics/EPIC-049-schema-de-donnees/US-191-meme-jeu-impose-par-la-base.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0074 : Les liens entre éléments d'un jeu passent par des clés étrangères composées avec le jeu

## Contexte

Qu'un personnage relié à un groupe, une intrigue, un objet, un document ou une session appartienne au même jeu n'est vérifié que par le code (règle de [`securite-api.md`](../../.claude/rules/securite-api.md)), et par `tests/integration/isolation.test.ts` ([revue du schéma](../archive/todo/schema-de-donnees.md), § 3). La pratique reconnue pour l'imposer en base est une clé étrangère qui porte aussi le jeu.

## Décision

- Chaque élément d'un jeu (`Character`, `Faction`, `Intrigue`, `Item`, `Document`, `TimelineEvent`, `Location`, `Session`) reçoit une contrainte d'unicité `(id, gameId)`.
- Chaque lien entre deux éléments porte le `gameId` et référence `(id, gameId)` de chaque côté : la base refuse un lien entre deux jeux.
- Les tables de liaison implicites de Prisma (`_CharacterFactions`, `_DocumentCharacters`…) ne peuvent pas porter de colonne : elles deviennent des modèles explicites avec `gameId`, leurs lignes recopiées.
- Les liens qui ont déjà un `gameId` (`CharacterRelation`, `RegistrationQuestionLink`) passent directement aux clés composées ; ceux qui n'en ont pas le reçoivent : `SessionAssignment`, `TimelineEventResponsible`, `Session.locationId`, `Item.locationCharacterId`, et les lignes qui relient une session à un autre élément du jeu (`SessionDocumentDelivery`, `SessionTrombinoscope`, `RegistrationPeriodSession`, `RegistrationDraw`, `Registration.invitedSessionId`, `RegistrationSession`, avec `Registration` qui reçoit le jeu de son vivier).
- Le code garde ses vérifications, qui donnent un message clair ; la base les rend impossibles à contourner.

## Conséquences

- Chaque table de liaison grossit d'une colonne, et les requêtes qui créent un lien fournissent le jeu.
- Une référence facultative qui s'efface à la suppression (`onDelete: SetNull`) poserait la colonne `gameId` à vide avec l'identifiant. PostgreSQL 15, celui du serveur, sait n'effacer que l'identifiant (`ON DELETE SET NULL (colonne)`), mais Prisma ne l'écrit pas, et une clé étrangère absente du schéma serait retirée par la migration générée suivante, Prisma comparant les clés étrangères. Ces références (`Item.locationCharacterId`, `Session.locationId`, `RegistrationDraw.sessionId`, `Registration.invitedSessionId`) passent donc en `onDelete: NoAction` dans le schéma : la fonction qui supprime l'élément visé vide d'abord la référence, dans la même transaction (`server/utils/contentWrites.ts`, `sessionWrites.ts`).
- Les migrations recopient les tables de liaison : elles sont marquées incompatibles, le build d'avant lisant encore les anciennes tables ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). Les anciennes tables restent remplies le temps d'un déploiement, puis sont retirées.

## Options écartées

- **Le code et le test d'isolation seuls** : recommandé dans la revue pour sa légèreté ; écarté par l'utilisatrice, qui veut que la base l'impose.
- **Déclencheurs (triggers) qui vérifient le jeu** : invisibles dans le schéma Prisma et plus difficiles à tester qu'une clé étrangère.
