---
id: US-017
titre: Un seul PJ par participant, réglable par jeu
statut: terminée
epic: EPIC-004
regles: [R7]
adr: []
---

# US-017 : Un seul PJ par participant, réglable par jeu

En tant qu'organisatrice, je veux qu'un participant ne joue qu'un PJ par session, sauf dans un jeu en plusieurs actes, afin d'éviter une erreur de casting.

## Critères d'acceptation

- [x] La fiche d'un jeu a une case « Un seul PJ par participant et par session », cochée par défaut, y compris pour les jeux existants.
- [x] Quand elle est cochée, enregistrer un casting qui donne deux PJ ou plus au même participant dans une session est refusé (400), avec le nom du participant.
- [x] Quand elle est décochée (jeu en plusieurs actes), plusieurs PJ par participant sont acceptés.
- [x] Les PNJ ne sont jamais limités.
- [x] La copie d'un jeu (legs) recopie ce réglage.

## Notes techniques

- Colonne `Game.singlePjPerParticipant Boolean @default(true)` : ajout seul ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- Contrôle dans `assertSessionCastRules` (`server/utils/sessionAssignments.ts`), qui sert à la création et à la modification d'une session.
- Schémas `createGameSchema` et `updateGameSchema`, formulaire du jeu (`GameForm.vue`), `gameCopy.ts`.

## Tests

- Unitaires (`tests/server/sessionAssignments.test.ts`) : `participantWithSeveralPjs`.
- Intégration (`sessionLifecycle.test.ts`) : casting refusé avec deux PJ quand la case est cochée, accepté quand elle est décochée, PNJ multiples acceptés, réglage enregistré.
