---
id: US-173
titre: Être prévenue quand une personne castée change ses réponses
statut: terminée
epic: EPIC-048
regles: [R16]
adr: []
---

# US-173 : Être prévenue quand une personne castée change ses réponses

En tant que organisatrice, je veux savoir qu'une personne castée a changé ses réponses, afin de revoir son casting.

## Critères d'acceptation

- [x] Étant donné une personne castée ou inscrite pour une session à venir, quand elle change ses réponses, alors chaque organisatrice reçoit un email, et un repère apparaît sur sa ligne.
- [x] Étant donné le repère, quand une organisatrice le marque comme lu, alors il disparaît pour toute l'équipe.
- [x] Étant donné une personne seulement intéressée, pré-inscrite ou en attente, quand elle change ses réponses, alors rien ne se déclenche.

## Notes techniques

`RegistrationSession.answersChangedAt`, posé par `saveRegistrationAnswers` quand les réponses diffèrent vraiment : réenregistrer sans changement, ou changer seulement ses disponibilités, ne déclenche rien. L'email ne recopie pas les réponses. Le POST de lecture passe par `useApiAction`. L'export de la personne ne porte pas ce repère de l'équipe.

## Tests

Intégration : `tests/integration/publicRegistrations.test.ts` (déclenchement, absence de déclenchement, lecture), `isolation.test.ts`, `seed.test.ts`. Playwright : `tests/e2e/registration.spec.ts`.
