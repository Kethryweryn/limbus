---
id: US-176
titre: Faire passer tout joueur par le questionnaire
statut: terminée
epic: EPIC-046
regles: [R20, R31]
adr: [../../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-176 : Faire passer tout joueur par le questionnaire

En tant qu'organisatrice, je veux que chaque joueur ait répondu au questionnaire, afin de pouvoir le caster avec les mêmes informations que les autres.

## Critères d'acceptation

- [x] Étant donné l'onglet Cast, quand je veux ajouter un joueur, alors je le choisis dans le vivier, ou je l'invite pour cette session.
- [x] Étant donné une personne hors du vivier, quand je tente de l'ajouter comme joueur, y compris par un assistant d'IA, alors c'est refusé avec un message clair.
- [x] Étant donné un PNJ, une personne de cuisine ou une organisatrice, alors je les ajoute à la main, comme aujourd'hui, sans statut de parcours ni demande de disponibilités.
- [x] Étant donné un PNJ qui reprend le rôle d'une personne qui a annulé, alors il garde ce fonctionnement.

## Notes techniques

`server/utils/sessionWrites.ts`, `sessionAssignments.ts`, onglet Cast, outils MCP `modifier_equipe` et `modifier_casting`. SPEC-004 et SPEC-014 à jour. Jeux de test sans joueur ajouté directement (`prisma/seed/pool.ts`).

Une personne du vivier choisie dans le cast est retenue et son personnage lui est réservé, dans la même transaction que le cast (`writeSelection`) : si une place manque, rien n'est écrit. Le contrôle porte sur les nouveaux joueurs : ceux déjà dans une session restent (ADR-0069). Un assistant d'IA ne pose pas de réservation (SPEC-014) : il retient par `decider_inscription`, et une personne sans place est refusée par `modifier_equipe` et `modifier_casting`.

## Tests

- Intégration : `tests/integration/castPlayers.test.ts` (refus hors vivier, PNJ, cuisine et orga acceptés, retenue depuis le cast, session complète, liste du vivier), `aiAssistants.test.ts` (outils d'IA), `seed.test.ts` (tout joueur a sa place dans le vivier).
- Playwright : `tests/e2e/casting.spec.ts` (onglet Cast, invitation pour la session).
