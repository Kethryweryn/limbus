---
id: US-176
titre: Faire passer tout joueur par le questionnaire
statut: à faire
epic: EPIC-046
regles: [R20, R31]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-176 : Faire passer tout joueur par le questionnaire

En tant qu'organisatrice, je veux que chaque joueur ait répondu au questionnaire, afin de pouvoir le caster avec les mêmes informations que les autres.

## Critères d'acceptation

- [ ] Étant donné l'onglet Cast, quand je veux ajouter un joueur, alors je le choisis dans le vivier, ou je l'invite pour cette session.
- [ ] Étant donné une personne hors du vivier, quand je tente de l'ajouter comme joueur, y compris par un assistant d'IA, alors c'est refusé avec un message clair.
- [ ] Étant donné un PNJ, une personne de cuisine ou une organisatrice, alors je les ajoute à la main, comme aujourd'hui, sans statut de parcours ni demande de disponibilités.
- [ ] Étant donné un PNJ qui reprend le rôle d'une personne qui a annulé, alors il garde ce fonctionnement.

## Notes techniques

`server/utils/sessionWrites.ts`, `sessionAssignments.ts`, onglet Cast, outils MCP `modifier_equipe` et `modifier_casting`. SPEC-004 et SPEC-014 à jour. Jeux de test sans joueur ajouté directement.

## Tests

Intégration : refus du joueur hors vivier, PNJ accepté, outil d'IA. Playwright : onglet Cast. `tests/integration/seed.test.ts`.
