---
id: US-188
titre: Indexer les clés étrangères et rendre le schéma homogène
statut: à faire
epic: EPIC-049
regles: []
adr: []
---

# US-188 : Indexer les clés étrangères et rendre le schéma homogène

En tant que mainteneuse de Limbus, je veux que chaque clé étrangère ait son index et que le schéma soit homogène, afin que les listes par jeu et les suppressions en cascade ne parcourent plus des tables entières.

## Critères d'acceptation

- [ ] Chaque clé étrangère relevée au § 1 de la fiche a un index (un index composé qui la commence suffit) ; aucune n'en est dépourvue, tables de liaison comprises.
- [ ] `Participant`, `SessionAssignment` et `SessionParticipant` ont un `createdAt` ; les lignes existantes reçoivent la date de la migration.
- [ ] `Session.location` et `SessionAssignment.participant` écrivent leur `onDelete` (`SetNull`, le comportement actuel) : la migration ne change aucune contrainte.
- [ ] `AiAuthorizationRequest.authorizationId` est une relation (`onDelete: Cascade`) ; la migration efface d'abord les demandes qui visent une autorisation disparue.
- [ ] Le commentaire de `RegistrationPeriod` ne cite plus les colonnes retirées.

## Notes techniques

Migration d'ajouts, compatible avec le build en service. Un test d'intégration lit `pg_constraint` et `pg_index` et échoue si une clé étrangère n'est couverte par aucun index : la règle vaut pour les tables à venir.

## Tests

Intégration : le test de couverture des clés étrangères ; `tests/integration/seed.test.ts`.
