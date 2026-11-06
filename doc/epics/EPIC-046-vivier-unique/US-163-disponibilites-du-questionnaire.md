---
id: US-163
titre: Dire où je suis disponible en répondant au questionnaire
statut: à faire
epic: EPIC-046
regles: [R7, R14]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-163 : Dire où je suis disponible en répondant au questionnaire

En tant que personne qui s'inscrit, je veux cocher les sessions où je suis disponible, afin d'être pré-inscrite sans remplir plusieurs questionnaires.

## Critères d'acceptation

- [ ] Étant donné des sessions ouvertes, quand je remplis le questionnaire, alors une question les liste avec leurs dates, et je peux n'en cocher aucune.
- [ ] Étant donné aucune session ouverte, alors la question n'apparaît pas.
- [ ] Étant donné une session cochée, quand mon inscription est reçue, alors je suis pré-inscrite pour cette session.
- [ ] Étant donné que je suis dans le vivier, quand je reviens par mon lien ou mon compte, alors je peux modifier mes réponses et mes disponibilités, même vivier fermé.
- [ ] Étant donné que je suis castée pour une session, alors décocher cette session ne me retire pas du cast : je dois annuler ma présence.

## Notes techniques

`RegistrationAnswerFields.vue`, `RegistrationResponse.vue`, `server/utils/registrationAvailability.ts`, `formRegistrations.ts`, `publicRegistrations.ts`, routes `public/registrations` et `me/registrations`.

## Tests

Intégration : `formRegistrations.test.ts`. Playwright : `registration.spec.ts`.
