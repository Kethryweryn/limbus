---
id: US-140
titre: L'estimation générale du questionnaire
statut: terminée
epic: EPIC-040
regles: [R2, R7, R13]
adr: [ADR-0064]
---

# US-140 : L'estimation générale du questionnaire

En tant qu'organisatrice, je veux une estimation d'ensemble de mon questionnaire et savoir quoi corriger d'abord, afin de ne pas avoir à combiner seule tous les repères.

## Critères d'acceptation

- [x] Dès qu'une personne a répondu à une question reliée, l'encadré s'ouvre sur l'estimation générale, avec un niveau d'ensemble, le plus grave de ses deux mesures. Sans réponse ou sans personnage PJ, elle n'apparaît pas.
- [x] La note moyenne porte sur les personnes placées par l'affectation de l'assistant, sans cadenas ni contraintes. Une personne dont la meilleure note est nulle n'entre pas dans l'affectation.
- [x] Note : bon à partir de 0,75 ; à revoir si la borne haute de l'intervalle reste sous 0,60, à confirmer si seule la valeur y est ; à surveiller entre les deux.
- [x] La note est « à confirmer » tant que les personnes qui ont au moins un point sont moins nombreuses que les personnages PJ, et la phrase dit pourquoi.
- [x] Ex æquo : bon jusqu'à une personne sur deux ; au-delà, à revoir si la borne basse de Wilson dépasse 50 %, à confirmer sinon. Une personne sans aucun point compte comme ex æquo dès que le jeu a deux personnages.
- [x] Le détail replié donne les valeurs, les intervalles, les seuils, les personnes sans rôle et sans point.
- [x] Les repères « à revoir » viennent en tête de la liste, du plus bloquant au moins bloquant pour le casting ; l'estimation dit combien il y en a.
- [x] L'estimation ne nomme aucune personne inscrite.

## Notes techniques

- `questionnaireEstimate` dans `utils/questionnaireQuality.ts` appelle `optimalAssignment`, sortie de `castingAssistant`, avec les notes déjà calculées.
- `wilsonInterval` reçoit pour la note moyenne un compte non entier, la somme des rapports (ADR-0064).

## Tests

- Unitaires : chaque niveau de chaque mesure, personnes sans rôle, sans point, moins de personnes que de rôles, un seul personnage, niveau d'ensemble, ordre des repères, phrases.
- Intégration : l'estimation par la route, sans nom de personne ; l'isolation de la route est déjà couverte.
- Playwright : l'estimation dans l'encadré.
