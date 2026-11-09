---
id: ADR-0074
titre: Les liens entre éléments d'un jeu passent par des clés étrangères composées avec le jeu
statut: remplacé en partie par ADR-0077
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../archive/epics/EPIC-049-schema-de-donnees/US-191-meme-jeu-impose-par-la-base.md, ../archive/epics/EPIC-049-schema-de-donnees/US-195-meme-jeu-sessions-et-vivier.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0074 : Les liens entre éléments d'un jeu passent par des clés étrangères composées avec le jeu

> Remplacé en partie par [ADR-0077](ADR-0077-references-videes-par-la-base.md) : une référence facultative qui se vide à la suppression de sa cible n'est plus en `NoAction` vidée par le code, mais en `ON DELETE SET NULL (colonne)`, vidée par la base. Le reste de la décision tient.

## Contexte

Qu'un personnage relié à un groupe, une intrigue, un objet, un document ou une session appartienne au même jeu n'est vérifié que par le code (règle de [`securite-api.md`](../../.claude/rules/securite-api.md)), et par `tests/integration/isolation.test.ts` ([revue du schéma](../archive/todo/schema-de-donnees.md), § 3). La pratique reconnue pour l'imposer en base est une clé étrangère qui porte aussi le jeu.

## Décision

- Chaque élément d'un jeu (`Character`, `Faction`, `Intrigue`, `Item`, `Document`, `TimelineEvent`, `Location`, `Session`) reçoit une contrainte d'unicité `(id, gameId)`.
- Chaque lien entre deux éléments porte le `gameId` et référence `(id, gameId)` de chaque côté : la base refuse un lien entre deux jeux.
- Les tables de liaison implicites de Prisma (`_CharacterFactions`, `_DocumentCharacters`…) ne peuvent pas porter de colonne : elles deviennent des modèles explicites avec `gameId`, leurs lignes recopiées.
- Les liens qui ont déjà un `gameId` (`CharacterRelation`, `RegistrationQuestionLink`) passent directement aux clés composées ; ceux qui n'en ont pas le reçoivent : `SessionAssignment`, `TimelineEventResponsible`, `Session.locationId`, `Item.locationCharacterId`, et les lignes qui relient une session à un autre élément du jeu (`SessionDocumentDelivery`, `SessionTrombinoscope`, `RegistrationPeriodSession`, `RegistrationDraw`, `Registration.invitedSessionId`, `RegistrationSession`, avec `Registration` qui reçoit le jeu de son vivier).
- Tous les liens entre éléments d'un même jeu sont couverts, y compris sept relevés à l'implémentation (choix de l'utilisatrice) : cases du trombinoscope d'un personnage (`CharacterTrombinoscopeEntry`, qui reçoit le jeu), ancien personnage d'un document (`Document.characterId`), session de report (`Session.postponedToSessionId`), report d'un paiement (`SessionPayment.carriedOverToSessionId`), place réservée (`SessionAssignment.reservedRegistrationId`), version du formulaire d'une inscription (`Registration.formVersionId`) et session d'un fichier téléversé (`UploadedFile.sessionId`).
- Chaque clé composée a `onUpdate: NoAction` : changer le jeu d'un élément relié est refusé, plutôt que de déplacer en cascade ce qui le référence.
- Mise en œuvre en deux lots : le contenu d'écriture ([US-191](../archive/epics/EPIC-049-schema-de-donnees/US-191-meme-jeu-impose-par-la-base.md)), puis les sessions, le vivier, les paiements et les fichiers ([US-195](../archive/epics/EPIC-049-schema-de-donnees/US-195-meme-jeu-sessions-et-vivier.md)).
- Le code garde ses vérifications, qui donnent un message clair ; la base les rend impossibles à contourner.

## Conséquences

- Chaque table de liaison grossit d'une colonne, et les requêtes qui créent un lien fournissent le jeu.
- Une référence facultative qui s'efface à la suppression (`onDelete: SetNull`) poserait la colonne `gameId` à vide avec l'identifiant. PostgreSQL 15, celui du serveur, sait n'effacer que l'identifiant (`ON DELETE SET NULL (colonne)`), mais Prisma ne l'écrit pas, et une clé étrangère absente du schéma serait retirée par la migration générée suivante, Prisma comparant les clés étrangères. Ces références (`Item.locationCharacterId`, `Session.locationId`, `RegistrationDraw.sessionId`, `Registration.invitedSessionId`) passent donc en `onDelete: NoAction` dans le schéma : la fonction qui supprime l'élément visé vide d'abord la référence, dans la même transaction (`server/utils/contentWrites.ts`, `sessionWrites.ts`).
- Les migrations recopient les tables de liaison : elles sont marquées incompatibles, le build d'avant lisant encore les anciennes tables ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). Les anciennes tables restent remplies le temps d'un déploiement, puis sont retirées.
- Vérifié à l'implémentation (US-191) : Prisma accepte une relation facultative composée d'une colonne facultative et du `gameId` obligatoire. Le client lit une table de liaison sous la forme `[{ character: … }]` : `unlinked` (`server/utils/contentLinks.ts`) rend la liste des éléments sous leur nom d'avant, et l'API garde sa forme. Un lien qu'écrit le build d'avant pendant les secondes du déploiement n'est pas recopié (accepté par l'utilisatrice). Jusqu'au retrait des anciennes tables ([US-193](../archive/epics/EPIC-049-schema-de-donnees/US-193-restes-de-transitions-et-pdf.md)), `migrate diff` propose de les supprimer : une migration générée entre-temps retire ces lignes.

## Options écartées

- **Le code et le test d'isolation seuls** : recommandé dans la revue pour sa légèreté ; écarté par l'utilisatrice, qui veut que la base l'impose.
- **Déclencheurs (triggers) qui vérifient le jeu** : invisibles dans le schéma Prisma et plus difficiles à tester qu'une clé étrangère.
