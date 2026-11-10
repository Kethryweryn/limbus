---
id: US-160
titre: Avoir un seul vivier par jeu
statut: terminée
epic: EPIC-046
regles: [R1, R2, R3]
adr: [../../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-160 : Avoir un seul vivier par jeu

En tant que organisatrice, je veux un seul vivier par jeu, afin de ne plus croiser plusieurs listes d'inscrits.

## Critères d'acceptation

- [x] Étant donné un jeu avec plusieurs périodes, quand la migration passe, alors il a un seul vivier, et une personne présente plusieurs fois y a une seule ligne, avec ses réponses les plus récentes et tous ses statuts par session.
- [x] Étant donné la page Inscriptions, quand je l'ouvre, alors chaque jeu montre son vivier, sans choix de portée ni de mode d'entrée.
- [x] Étant donné un vivier fermé, quand une nouvelle personne ouvre le lien de diffusion, alors elle lit « inscriptions closes », tandis qu'une personne déjà dedans garde son accès.
- [x] Étant donné un jeu qui a déjà un vivier, quand on tente d'en créer un second, alors c'est refusé.

## Notes techniques

Tables et colonnes d'ADR-0069, première migration seulement. `RegistrationPeriodForm`, `RegistrationPeriodCard`, `pages/registrations`, `server/utils/registrationPeriods.ts`, `registrationPeriodWrites.ts`, outils MCP `creer_periode_inscription` et `modifier_periode_inscription`. Lisent aussi les périodes : `server/api/public/games/[slug].get.ts` et la page publique (SPEC-009), `registrationQuestionLinks.ts`, `registrationOptionExpectations.ts`, `questionnaireQuality.ts`. Livrée avec US-161 et US-171 (ADR-0069).

## Tests

Intégration : `registrationPeriods.test.ts`, `formRegistrations.test.ts`, `isolation.test.ts`. Playwright : `registrationActions.spec.ts`, `publicPage.spec.ts`. La migration, à usage unique, a été essayée sur des données à l'ancien format (doublons, statuts repris, réserve, demande) sur une base à part, sans test gardé : la seconde migration la rend sans objet.
