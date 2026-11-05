---
id: US-143
titre: Voir ce que donnerait une inscription typique
statut: terminée
epic: EPIC-041
regles: [R7, R8, R9, R10]
adr: [ADR-0062, ADR-0064, ADR-0061]
---

# US-143 : Voir ce que donnerait une inscription typique

En tant qu'organisatrice, je veux voir ce que donnerait une inscription typique, afin de repérer avant l'ouverture les personnages peu ou trop demandés et les meilleures notes ex æquo.

## Critères d'acceptation

- [x] Des personnes fictives, autant que de personnages PJ, répondent à toutes les questions reliées selon les proportions de R6. La simulation est répétée 1 000 fois, sans figer la page.
- [x] Note obtenue et part des ex æquo sont données avec leur médiane et une fourchette qui contient 95 % des simulations. Note : « bon » à partir de 0,75, « à surveiller » de 0,60 à 0,75, « à revoir » sous 0,60. Ex æquo : « bon » jusqu'à une personne sur deux, « à revoir » au-delà. Jamais « à confirmer ».
- [x] Un personnage relié est « à surveiller » quand la médiane de ses présences parmi les 3 meilleurs est sous 2, ou la médiane de ses premières places au-dessus de 3. La phrase dit dans quelle part des simulations c'est le cas : « Aldric serait peu demandé dans 7 simulations sur 10 ».
- [x] La même prévision revient à chaque ouverture tant que le formulaire, les liens, les personnages et les proportions ne changent pas. Corriger un libellé ou renommer un personnage ne la change pas.
- [x] La phrase rappelle les hypothèses. Sans proportions, elle dit que la prévision est optimiste.
- [x] Si le calcul échoue, la partie le dit, et les autres repères restent lisibles.

## Notes techniques

- `runForecast` (`utils/questionnaireForecast.ts`), fonction pure, dans un Web Worker (`utils/questionnaireForecast.worker.ts`).
- Les points de chaque réponse possible sont calculés une fois par `castingScore`, puis additionnés : une note est une somme de points par lien. Sans cela, 1 000 tirages de 60 personnes et 60 personnages feraient 3,6 millions d'appels.
- Les calculs de SPEC-015 sont extraits de `utils/questionnaireQuality.ts` et partagés : présence et premières places (`demandCounts`), rapports de l'affectation (`assignmentRatios`), ex æquo (`tiedCount`). Médiane et fourchette : `quantile` (`utils/statistics.ts`).
- Graine : empreinte de la forme du questionnaire (identifiants, types, options, liens, factions et intrigues des personnages, proportions), dans un ordre fixé, sans libellés ni noms.

## Tests

- Unitaires : les points additionnés égalent `castingScore` ; même entrée, même résultat, quel que soit l'ordre des liens ou des personnages ; un changement de proportions change le résultat ; niveaux à la médiane ; personnage peu ou trop demandé ; personnage sans lien écarté ; proportions (0 %, 100 %) respectées. La durée pour 60 personnages se mesure à la main : un seuil de temps serait instable en CI.
- Bout en bout : le Web Worker tourne malgré la CSP, et la prévision change une fois des proportions enregistrées.
- Message « Impossible de calculer la prévision. » : testé depuis [US-146](../EPIC-042-relecture-et-melange-du-questionnaire/US-146-melange-des-options.md), avec un Web Worker simulé qui échoue.
