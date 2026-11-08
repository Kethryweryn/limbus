---
id: US-188
titre: Indexer les clés étrangères et rendre le schéma homogène
statut: terminée
epic: EPIC-049
regles: []
adr: []
---

# US-188 : Indexer les clés étrangères et rendre le schéma homogène

En tant que mainteneuse de Limbus, je veux que chaque clé étrangère ait son index et que le schéma soit homogène, afin que les listes par jeu et les suppressions en cascade ne parcourent plus des tables entières.

## Critères d'acceptation

- [x] Chaque clé étrangère relevée au § 1 de la fiche a un index (un index composé qui la commence suffit) ; aucune n'en est dépourvue, tables de liaison comprises.
- [x] `Participant`, `SessionAssignment` et `SessionParticipant` ont un `createdAt` ; les lignes existantes reçoivent la date de la migration.
- [x] `Session.location` et `SessionAssignment.participant` écrivent leur `onDelete` (`SetNull`, le comportement actuel) : la migration ne change aucune contrainte.
- [x] `AiAuthorizationRequest.authorizationId` est une relation (`onDelete: Cascade`) ; la migration efface d'abord les demandes qui visent une autorisation disparue.
- [x] Le commentaire de `RegistrationPeriod` ne cite plus les colonnes retirées.
- [x] La base suit de nouveau exactement le schéma : la migration rattrape l'écart laissé par d'anciennes migrations (valeur par défaut de `updatedAt`, noms de contraintes et d'index hérités), et une migration générée sur le schéma est vide.

## Notes techniques

Migration d'ajouts, compatible avec le build en service. Un test d'intégration lit `pg_constraint` et `pg_index` et échoue si une clé étrangère n'est couverte par aucun index : la règle vaut pour les tables à venir.

## Tests

Intégration : `tests/integration/schema.test.ts` (aucune clé étrangère sans index) ; `seed.test.ts`, `aiAssistants.test.ts`, `participants.test.ts`, `privacy.test.ts`, `accountDeletion.test.ts`, `castPlayers.test.ts`, `sessionLifecycle.test.ts`, `isolation.test.ts`.

Migration : `20261117090000_index_des_cles_etrangeres`, jouée sur une base neuve ; la différence entre la base migrée et le schéma est vide.
