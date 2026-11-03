---
id: US-133
titre: L'encadré « Qualité du questionnaire » et les liens manquants
statut: à faire
epic: EPIC-037
regles: [R1, R2, R3, R4, R5]
adr: [ADR-0061, ADR-0050, ADR-0051]
---

# US-133 : L'encadré « Qualité du questionnaire » et les liens manquants

En tant qu'organisatrice, je veux savoir, dès l'écriture du formulaire, quels personnages, questions et options ne sont reliés à rien, afin de corriger mon questionnaire avant d'ouvrir les inscriptions.

## Critères d'acceptation

- [ ] Dans l'éditeur du formulaire d'inscription, sous les liens, un encadré « Qualité du questionnaire » liste les repères du formulaire et des liens enregistrés. Il se recalcule après chaque enregistrement.
- [ ] Chaque repère a un niveau (bon, à surveiller, à revoir), une phrase, ce qu'il faut faire, et un détail replié avec la valeur, le seuil et la référence.
- [ ] Un personnage PJ qu'aucune réponse ne rejoint, ni directement ni par sa faction ou son intrigue, est « à revoir » : « Aldric n'est relié à aucune réponse : l'assistant ne pourra lui proposer personne. »
- [ ] Une question à choix ou une échelle sans aucun lien est « à surveiller », avec la mention que ce peut être voulu. Une option sans lien dans une question reliée par ailleurs est « à surveiller ». Une question à texte libre n'a pas de repère.
- [ ] Sans aucun problème, l'encadré dit que les liens permettent de choisir.
- [ ] Seule l'équipe du jeu obtient les repères ; ils ne nomment aucune personne inscrite.

## Notes techniques

- Route `GET /api/games/:id/registration-form-quality` (`requireGameAccess`), qui lit le formulaire, les liens (`currentQuestionLinks`) et les personnages PJ avec leurs factions et intrigues.
- Calculs purs dans `utils/questionnaireQuality.ts` ; niveaux, comptes, valeurs et seuils rendus par la route, phrases rédigées par l'interface.
- L'encadré lit avec `useApiFetch(url, { offlineCache: true })` et se relit après l'enregistrement du formulaire ou des liens.

## Tests

- Unitaires : personnage sans lien, lien par faction ou intrigue qui suffit, question sans lien, option sans lien, question à texte libre ignorée.
- Intégration : la route rend les repères d'un jeu d'Alice ; `isolation.test.ts` : Alice n'obtient pas ceux du jeu de Bob.
- Bout en bout : l'encadré montre un personnage sans lien, puis plus rien après l'ajout du lien.
