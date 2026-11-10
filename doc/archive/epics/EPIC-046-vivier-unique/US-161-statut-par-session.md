---
id: US-161
titre: Suivre une personne session par session
statut: terminée
epic: EPIC-046
regles: [R8, R17, R18, R20, R24, R25, R29, R30, R31]
adr: [../../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-161 : Suivre une personne session par session

En tant que organisatrice, je veux voir et décider le statut d'une personne pour chaque session, afin qu'elle puisse avancer sur plusieurs sessions en parallèle.

## Critères d'acceptation

- [x] Étant donné une personne pré-inscrite pour deux sessions, quand je la retiens pour la première, alors elle reste pré-inscrite pour la seconde.
- [x] Étant donné une session pleine, quand je retiens une personne de plus, alors c'est refusé, et le message dit qu'il faut créer un personnage pour ajouter une place.
- [x] Étant donné une personne du vivier sans réponse ou « pas disponible », quand je l'ajoute à la main, alors elle est retenue, et l'écran signale son refus éventuel.
- [x] Étant donné un rejoueur exclu, quand je le retiens à la main, alors c'est possible, avec un signalement.
- [x] Étant donné deux personnes qui ne veulent pas se croiser, retenues pour la même session, alors une alerte apparaît pour cette session seulement.
- [x] Étant donné une personne à rembourser ou remboursée, ou remplacée, alors sa ligne passe à « annulation », et elle reste intéressée ; retirer la marque de remboursement ne lui rend pas sa place ; la remplaçante du vivier suit son parcours, et un PNJ garde son fonctionnement.
- [x] Étant donné une session reportée, alors les personnes castées ou inscrites sont « transférées » sur l'ancienne et gardent leur statut sur la nouvelle ; les pré-inscrites et la liste d'attente ne sont pas reprises.
- [x] Étant donné une personne transférée, quand elle répond qu'elle n'est pas disponible à la demande de présence, alors elle est en « annulation » sur les deux ; la rembourser ensuite la désinscrit aussi.
- [x] Étant donné un personnage PJ supprimé alors que la session est pleine, alors personne n'est retiré, et la session est signalée en surnombre.
- [x] Étant donné une personne retenue et annoncée, quand elle confirme, alors elle devient inscrite à cette session seulement et le participant de session est créé.

## Notes techniques

`RegistrationSession` (ADR-0069). `server/utils/registrationSelection.ts`, `registrationAffinities.ts`, `participations.ts`, `allergies.ts`, `sessionAssignments.ts`, `RegistrationSelection.vue`, espace « Je participe ». Le statut « non retenue » disparaît. `announceSelection` et `castingAssistant.ts` passent au nouveau modèle sans changer de comportement : l'annonce reste celle d'aujourd'hui jusqu'à US-172, et l'assistant garde ses candidats jusqu'à US-170. Remboursement, remplacement et report : `server/utils/sessionPayments.ts`, `server/utils/sessionLifecycle.ts`, SPEC-004 à jour.

## Tests

Intégration : `registrationSelection.test.ts`, `registrationAffinities.test.ts`, `allergies.test.ts`, `castingAssistant.test.ts`, `isolation.test.ts`. Playwright : `registration.spec.ts`, `registrationActions.spec.ts`, `offline.spec.ts`.
