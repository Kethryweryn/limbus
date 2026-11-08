---
titre: Revue du schéma de données
statut: prête
epic: ../../epics/EPIC-049-schema-de-donnees/README.md
date: 2026-11-08
---

# Revue du schéma de données

## Besoin

Une relecture de `prisma/schema.prisma` et des migrations, comparée aux pratiques reconnues de PostgreSQL et de Prisma, a relevé plusieurs écarts. Le schéma est sain dans l'ensemble : suppressions en cascade réfléchies, montants en centimes entiers, jetons gardés en empreinte, formulaires versionnés, tirages rejouables. Les écarts ne gênent pas avec les volumes actuels, mais leur coût grandit avec les données, et certains laissent la base accepter des valeurs que le code refuse.

### 1. Clés étrangères sans index

PostgreSQL n'indexe pas une clé étrangère de lui-même. Sans index, une liste filtrée par cette colonne et une suppression en cascade parcourent toute la table.

- `gameId` n'a pas d'index sur `Character`, `Faction`, `Intrigue`, `Item`, `Document`, `Session` et `Location`, alors que toutes les listes de l'écriture filtrent par jeu et que supprimer un jeu les parcourt.
- Autres colonnes sans index : `SessionAssignment.characterId` et `participantId`, `Session.locationId`, `Document.characterId`, `Item.locationCharacterId`, `RegistrationQuestionLink.characterId`, `factionId` et `intrigueId`, `SessionPayment.tariffId`, `transferredToParticipantId` et `carriedOverToSessionId`, `SessionTariff.baseTariffId`, `SessionTrombinoscope.viewerCharacterId`, `Registration.formVersionId`, `RegistrationRequest.formVersionId`, `AiAuthorization.clientId`, `AiAuthorizationRequest.clientId`, `Game.transferToUserId`, `GameInvitation.acceptedById`.
- Les colonnes `…ById` vers `User` (`Registration.invitedById` et `withdrawnById`, `RegistrationSession.cancelledById` et `retainedById`, `RegistrationDraw.createdById` et `cancelledById`) : effacer un compte parcourt chacune de ces tables en entier.

### 2. Valeurs à liste fermée que la base ne contrôle pas

Une trentaine de colonnes `String` n'acceptent que quelques valeurs : `status`, `role`, `type`, `kind`, `level`, `state`, `replayPolicy`, `refundStatus`, `answer`, `selectionMode`, `defaultRole`, les éléments de `Document.audiences`… Aucune n'a de type énuméré ni de contrainte `CHECK` : seul le code les vérifie, et une faute dans une migration ou une requête SQL passe sans erreur.

### 3. Règles métier tenues par le code seul

- `RegistrationQuestionLink` : exactement une cible (personnage, faction ou intrigue) devrait être renseignée ; rien ne l'impose, ni l'absence de doublon.
- `CharacterRelation` : rien n'empêche une relation d'un personnage avec lui-même, ni deux relations sur la même paire.
- Qu'un élément lié appartienne au même jeu n'est vérifié que par le code (règle de [`securite-api.md`](../../../.claude/rules/securite-api.md), couverte par `tests/integration/isolation.test.ts`). La pratique reconnue pour l'imposer en base est une clé étrangère composée `(id, gameId)`.
- Une seule fiche par personne et par organisatrice ([US-185](../../epics/EPIC-045-retours-du-cahier-de-tests/US-185-une-fiche-par-personne.md)) : `Participant` n'a pas de propriétaire, l'unicité ne peut pas être une contrainte ; elle repose sur un verrou consultatif.
- L'unicité de `User.email` dépend de la mise en minuscules faite par le code, pas de la base (ni `citext` ni index sur `lower(email)`).

### 4. Dates sans fuseau horaire

Prisma crée des colonnes `timestamp(3)` sans fuseau ; aucune migration n'utilise `timestamptz`. Tout passe par Prisma, qui écrit en UTC, donc rien n'est faux aujourd'hui ; mais un `now()` dans du SQL écrit à la main dépend du fuseau du serveur. La documentation de PostgreSQL recommande `timestamptz`.

### 5. PDF en texte base64

`SessionTrombinoscope.contentPdfBase64` garde le PDF en base64 dans une colonne texte, environ un tiers plus gros que le binaire, alors que `SessionDocumentDelivery.copyPdf` est en `Bytes`.

### 6. Restes de transitions

- `Participant.notes` (vidée par [ADR-0040](../../adr/ADR-0040-notes-par-jeu.md), « colonne à supprimer » selon son commentaire) et `GameInvitation.token` (vide depuis [ADR-0034](../../adr/ADR-0034-jeton-d-invitation-hache.md)) ne servent plus.
- `Document.audience` et `Document.characterId` ([ADR-0072](../../adr/ADR-0072-public-des-documents.md)) restent tant que le build d'avant peut tourner.
- Le commentaire de `RegistrationPeriod` cite huit colonnes « plus lues » qui ne sont déjà plus dans le schéma.

### 7. Homogénéité

- `createdAt` manque sur `Participant`, `SessionAssignment` et `SessionParticipant`.
- `Session.location` et `SessionAssignment.participant` n'écrivent pas leur `onDelete` : Prisma applique son comportement par défaut, juste mais implicite.
- `AiAuthorizationRequest.authorizationId` n'est pas déclaré comme relation.

## Proposition

Corriger ces écarts par des migrations compatibles avec le build en service ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)), ou marquées incompatibles quand un changement de type l'impose, sans changement visible pour les personnes qui utilisent Limbus. Le point de la fiche participant sans propriétaire (§ 3) change le fonctionnement des comptes : il part dans sa propre fiche, [Un compte pour chaque participant](../../todo/compte-pour-chaque-participant.md).

## Découpage

Un epic technique, [EPIC-049](../../epics/EPIC-049-schema-de-donnees/README.md), avec cette fiche pour spec :

1. Index des clés étrangères et homogénéité (§ 1, § 6, § 7) : [US-188](../../epics/EPIC-049-schema-de-donnees/US-188-index-et-homogeneite.md).
2. Valeurs à liste fermée en énumérations (§ 2) : [US-189](../../epics/EPIC-049-schema-de-donnees/US-189-enumerations.md).
3. Règles des liens du questionnaire et des relations (§ 3) : [US-190](../../epics/EPIC-049-schema-de-donnees/US-190-regles-des-liens-et-des-relations.md).
4. Même jeu imposé par la base (§ 3) : [US-191](../../epics/EPIC-049-schema-de-donnees/US-191-meme-jeu-impose-par-la-base.md).
5. Emails comparés sans tenir compte de la casse (§ 3) : [US-192](../../epics/EPIC-049-schema-de-donnees/US-192-emails-sans-casse.md).
6. Restes de transitions et PDF du trombinoscope en binaire (§ 5, § 6) : [US-193](../../epics/EPIC-049-schema-de-donnees/US-193-restes-de-transitions-et-pdf.md).
7. Dates avec fuseau horaire (§ 4) : [US-194](../../epics/EPIC-049-schema-de-donnees/US-194-dates-avec-fuseau.md).

## Décisions

Tranchées par l'utilisatrice le 2026-11-09 :

- **Valeurs à liste fermée** : des énumérations Prisma ([ADR-0073](../../adr/ADR-0073-enumerations-du-schema.md)), plutôt que des contraintes `CHECK`.
- **Dates** : converties en `timestamptz`, en dernier, après vérification sur une copie ([ADR-0076](../../adr/ADR-0076-dates-avec-fuseau.md)).
- **Même jeu** : imposé par la base, par des clés étrangères composées ([ADR-0074](../../adr/ADR-0074-meme-jeu-impose-par-la-base.md)).
- **Emails** : comparés sans tenir compte de la casse par le type `citext` ([ADR-0075](../../adr/ADR-0075-emails-en-citext.md)).
- **Propriétaire d'une fiche participant** : la fiche appartient à la personne elle-même, par un compte pré-créé ; traité dans [sa fiche](../../todo/compte-pour-chaque-participant.md).
- **Fichiers** : les PDF générés restent en base, comme le décide [ADR-0044](../../adr/ADR-0044-copies-des-envois.md) (petits, effacés le lendemain de la session ; la littérature l'admet pour des fichiers de courte durée, au prix de la taille de la base) ; le trombinoscope passe du base64 au binaire, par une nouvelle colonne.
- **Dates de création** : ajoutées, les lignes existantes recevant la date de la migration.
- **Relations entre personnages** : deux personnages peuvent avoir plusieurs relations ; seule la relation d'un personnage avec lui-même est interdite.

## Points à trancher

Aucun.
