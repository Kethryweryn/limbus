---
id: US-161
titre: Suivre une personne session par session
statut: à faire
epic: EPIC-046
regles: [R8, R17, R18, R20, R24, R25]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-161 : Suivre une personne session par session

En tant que organisatrice, je veux voir et décider le statut d'une personne pour chaque session, afin qu'elle puisse avancer sur plusieurs sessions en parallèle.

## Critères d'acceptation

- [ ] Étant donné une personne pré-inscrite pour deux sessions, quand je la retiens pour la première, alors elle reste pré-inscrite pour la seconde.
- [ ] Étant donné une session pleine, quand je retiens une personne de plus, alors c'est refusé avec un message clair.
- [ ] Étant donné une personne du vivier sans réponse ou « pas disponible », quand je l'ajoute à la main, alors elle est retenue, et l'écran signale son refus éventuel.
- [ ] Étant donné un rejoueur exclu, quand je tente de le retenir, alors c'est refusé.
- [ ] Étant donné deux personnes qui ne veulent pas se croiser, retenues pour la même session, alors une alerte apparaît pour cette session seulement.
- [ ] Étant donné une personne retenue et annoncée, quand elle confirme, alors elle devient inscrite à cette session seulement et le participant de session est créé.

## Notes techniques

`RegistrationSession` (ADR-0069). `server/utils/registrationSelection.ts`, `registrationAffinities.ts`, `participations.ts`, `allergies.ts`, `sessionAssignments.ts`, `RegistrationSelection.vue`, espace « Je participe ». Le statut « non retenue » disparaît.

## Tests

Intégration : `registrationSelection.test.ts`, `registrationAffinities.test.ts`, `isolation.test.ts`. Playwright : `registration.spec.ts`, espace participant.
