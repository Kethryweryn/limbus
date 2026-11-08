---
titre: Revue du schéma de données
statut: à trancher
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
- Qu'un élément lié appartienne au même jeu n'est vérifié que par le code (règle de `securite-api.md`, couverte par `tests/integration/isolation.test.ts`). La pratique reconnue pour l'imposer en base est une clé étrangère composée `(id, gameId)`.
- Une seule fiche par personne et par organisatrice (US-185) : `Participant` n'a pas de propriétaire, l'unicité ne peut pas être une contrainte ; elle repose sur un verrou consultatif.
- L'unicité de `User.email` dépend de la mise en minuscules faite par le code, pas de la base (ni `citext` ni index sur `lower(email)`).

### 4. Dates sans fuseau horaire

Prisma crée des colonnes `timestamp(3)` sans fuseau ; aucune migration n'utilise `timestamptz`. Tout passe par Prisma, qui écrit en UTC, donc rien n'est faux aujourd'hui ; mais un `now()` dans du SQL écrit à la main dépend du fuseau du serveur. La documentation de PostgreSQL recommande `timestamptz`.

### 5. PDF en texte base64

`SessionTrombinoscope.contentPdfBase64` garde le PDF en base64 dans une colonne texte, environ un tiers plus gros que le binaire, alors que `SessionDocumentDelivery.copyPdf` est en `Bytes`.

### 6. Restes de transitions

- `Participant.notes` (vidée par ADR-0040, « colonne à supprimer » selon son commentaire) et `GameInvitation.token` (vide depuis ADR-0034) ne servent plus.
- `Document.audience` et `Document.characterId` (ADR-0072) restent tant que le build d'avant peut tourner.
- Le commentaire de `RegistrationPeriod` cite huit colonnes « plus lues » qui ne sont déjà plus dans le schéma.

### 7. Homogénéité

- `createdAt` manque sur `Participant`, `SessionAssignment` et `SessionParticipant`.
- `Session.location` et `SessionAssignment.participant` n'écrivent pas leur `onDelete` : Prisma applique son comportement par défaut, juste mais implicite.
- `AiAuthorizationRequest.authorizationId` n'est pas déclaré comme relation.

## Proposition

Corriger ces écarts par des migrations compatibles avec le build en service (ADR-0024), sans changement visible pour les personnes qui utilisent Limbus. Chaque choix technique retenu ci-dessous fait l'objet d'un ADR.

## Découpage envisagé

1. **Index et homogénéité** : index des clés étrangères (§ 1), `onDelete` explicites, relation de `AiAuthorizationRequest`, commentaire de `RegistrationPeriod` (§ 6, § 7). Ajouts seulement, sans risque pour le build en service.
2. **Contraintes** : valeurs à liste fermée (§ 2) et règles de `RegistrationQuestionLink` et `CharacterRelation` (§ 3), après avoir vérifié qu'aucune donnée de production ne les enfreint.
3. **Restes de transitions** : retrait des colonnes devenues inutiles (§ 6), en migration marquée incompatible.
4. **PDF du trombinoscope en binaire** (§ 5).
5. **Dates avec fuseau** (§ 4), si retenu.

## Points à trancher

- **Valeurs à liste fermée : `enum` Prisma ou contrainte `CHECK` ?** Un `enum` est typé jusque dans le client Prisma, mais retirer une valeur demande de recréer le type, ce que la règle des migrations compatibles rend pénible. Une contrainte `CHECK`, écrite à la main dans la migration, se remplace d'un bloc ; Prisma ne la décrit pas dans le schéma mais la laisse en place. Recommandation : `CHECK`, avec un test d'intégration qui confronte chaque contrainte à la liste du code, pour qu'elles ne divergent pas.
- **Dates avec fuseau : convertir les colonnes en `timestamptz` ?** C'est un changement de type, donc une migration marquée incompatible, qui réécrit chaque table. Recommandation : oui, en dernier, après avoir vérifié sur une copie que le build en service lit et écrit correctement les colonnes converties (non testé à ce jour).
- **Même jeu imposé en base par des clés étrangères composées `(id, gameId)` ?** Lourd : chaque table de liaison gagne une colonne `gameId`. Recommandation : non, le code et le test d'isolation suffisent.
- **Unicité des emails sans tenir compte de la casse : `citext` ou index sur `lower(email)` ?** `citext` demande une extension PostgreSQL, à créer sur le serveur partagé ; un index sur une expression n'est pas décrit par Prisma, et reste à vérifier qu'une migration générée ne le supprime pas. Pas de recommandation avant ces deux vérifications ; à défaut, un test qui contrôle que chaque écriture d'email passe par la mise en minuscules.
- **Propriétaire d'une fiche participant**, pour imposer l'unicité de US-185 en base : changement de modèle qui dépasse cette revue. Recommandation : hors de ce chantier.
- **PDF du trombinoscope** : nouvelle colonne `Bytes` écrite à côté de l'ancienne, puis retrait de celle-ci, ou simple régénération ? Recommandation : nouvelle colonne, l'ancienne retirée au déploiement suivant, comme pour ADR-0072.
