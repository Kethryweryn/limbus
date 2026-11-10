---
id: US-181
titre: Toujours demander le contact d'urgence et les allergies
statut: terminée
epic: EPIC-045
regles: [R8]
adr: []
---

# US-181 : Toujours demander le contact d'urgence et les allergies

En tant qu'organisatrice, je veux que chaque personne du vivier donne un contact d'urgence et puisse déclarer ses allergies, afin de les retrouver sur sa fiche quel que soit le jeu (à la suite des retours A5-1 et A5-2 du cahier).

## Critères d'acceptation

- [x] Étant donné l'éditeur du questionnaire, alors « Contact d'urgence » est demandé et obligatoire, et « Allergies » demandé et facultatif, sans qu'on puisse les décocher.
- [x] Étant donné une version de questionnaire enregistrée avant, qui ne les demandait pas, alors le questionnaire les pose quand même.
- [x] Étant donné une personne qui répond sans contact d'urgence, alors sa réponse est refusée.
- [x] Étant donné les jeux de test, alors chaque inscription répondue a un contact d'urgence.

## Notes techniques

`LOCKED_REGISTRATION_FIELDS` dans `utils/registrationForms.ts`, appliqué par `normalizeRegistrationFormDefinition` : toute lecture d'une version, ancienne comprise, et tout enregistrement. `components/RegistrationFormEditor.vue`, `server/mcp/registrationWrites.ts` (description), `prisma/seed/`. [SPEC-001](../../../specs/SPEC-001-inscriptions.md), R8. Choix de l'utilisatrice le 2026-11-08 : contact d'urgence obligatoire, allergies toujours posées ; les inscriptions déjà faites sans ces champs restent vides, seuls les jeux de test sont complétés.

## Tests

`tests/server/registrationForms.test.ts`, `tests/e2e/registration.spec.ts` (éditeur et ancienne version), `tests/integration/seed.test.ts`, et les tests d'inscription adaptés (`formRegistrations`, `registrationQuestions`, `registrationDraws`, `profile`).
