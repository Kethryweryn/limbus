---
id: US-095
titre: Rattacher les affinités à des personnes du jeu
statut: terminée
epic: EPIC-023
regles: [R23, R24]
adr: [ADR-0049]
---

# US-095 : Rattacher les affinités à des personnes du jeu

En tant qu'organisatrice, je veux rattacher chaque personne citée dans les affinités d'une inscription à une personne du jeu, pour que Limbus puisse en tenir compte dans la sélection.

## Critères d'acceptation

- [x] Dans le détail d'une inscription, chaque ligne « avec qui je veux jouer », « avec qui je ne veux pas jouer » et « les personnes que je ne veux pas croiser » montre la personne rattachée, ou des suggestions de personnes au nom proche.
- [x] L'équipe rattache une ligne d'un clic sur une suggestion, ou en choisissant n'importe quelle personne du jeu ; elle peut détacher la ligne.
- [x] Une ligne qui ne vise personne du jeu peut être marquée « inconnue » ; elle ne compte plus parmi les lignes à rattacher.
- [x] Rien n'est rattaché sans l'équipe, même quand le nom correspond exactement.
- [x] Quand la personne modifie ses réponses, une ligne restée identique garde son rattachement.
- [x] La sélection signale les inscriptions qui ont des lignes à rattacher.
- [x] Le rattachement n'est visible que des organisateurs du jeu (R24) ; l'export des données de la personne contient ses affinités avec la personne rattachée, jamais celles des autres qui la visent.

## Notes techniques

- `RegistrationAffinity.targetParticipantId` et `targetUnknown` ; `POST /api/registration-affinities/:id/link`.
- Suggestions calculées à la lecture par `utils/affinityMatching.ts`.

## Tests

- Unitaires : similarité des noms.
- Intégration : rattacher, marquer inconnue, refus d'une personne d'un autre jeu, rattachement gardé à une nouvelle réponse, isolation de la route.
