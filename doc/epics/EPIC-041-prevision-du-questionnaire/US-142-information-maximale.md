---
id: US-142
titre: Savoir si les questions peuvent départager les personnages
statut: terminée
epic: EPIC-041
regles: [R4, R5]
adr: [ADR-0062]
---

# US-142 : Savoir si les questions peuvent départager les personnages

En tant qu'organisatrice, je veux savoir si mes questions apportent assez d'information pour distinguer mes personnages, afin de ne pas ouvrir les inscriptions avec un questionnaire trop pauvre.

## Critères d'acceptation

- [x] L'encadré « Qualité du questionnaire » a une partie « Prévision », avec son niveau dans le titre. Elle est dépliée tant qu'aucune réponse n'est reçue, repliée ensuite, et reste visible dans les deux cas.
- [x] Elle porte sur le formulaire, les liens et les proportions enregistrés, et le dit. Sans question reliée ou sans personnage PJ, elle n'apparaît pas.
- [x] Une question à choix unique apporte log₂ du nombre de groupes d'options de mêmes liens (les options sans lien forment un groupe) ; une échelle reliée, log₂(5) ; une question à choix multiples, un bit par option reliée.
- [x] Si le total est inférieur à log₂(N) pour N personnages PJ, le repère est « à revoir » : « Vos questions distinguent au plus 12 profils de réponses, pour 16 personnages ». Sinon, il est « bon ».
- [x] Le détail donne l'information de chaque question et, si elle a des proportions, l'information attendue avec celles-ci (entropie de Shannon, par groupe d'options pour un choix unique, par option reliée pour des choix multiples). Il rappelle que c'est une condition nécessaire, pas suffisante.

## Notes techniques

- `maximalInformation` (`utils/questionnaireForecast.ts`), fonction pure ; `shannonEntropy` (`utils/statistics.ts`).
- La route de l'encadré rend aussi `forecastInput` (questions, liens, proportions) ; les personnages sont déjà rendus (US-135).
- Phrases : `utils/questionnaireForecastText.ts`. Affichage : `components/RegistrationFormForecast.vue`, qui réutilise `QualityFindingItem`.

## Tests

- Unitaires : groupes d'options de mêmes liens, échelle, choix multiples, seuil exact à log₂(N), entropie avec proportions.
- Intégration : la route rend le formulaire, les liens et les proportions.
- Bout en bout : la phrase « à revoir » avant les réponses, puis la partie repliée une fois des réponses reçues.
