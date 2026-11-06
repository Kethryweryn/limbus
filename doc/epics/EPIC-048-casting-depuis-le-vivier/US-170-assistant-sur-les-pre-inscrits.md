---
id: US-170
titre: Proposer le casting parmi les pré-inscrits
statut: à faire
epic: EPIC-048
regles: [R21]
adr: []
---

# US-170 : Proposer le casting parmi les pré-inscrits

En tant que organisatrice, je veux que l'assistant propose des personnages aux pré-inscrits, afin de faire le casting à partir des personnes disponibles.

## Critères d'acceptation

- [ ] Étant donné une session, quand je lance l'assistant, alors il répartit le cast, les personnes retenues et les pré-inscrits, sans les autres personnes du vivier.
- [ ] Étant donné une personne ajoutée à la main, alors elle entre dans les propositions.
- [ ] Étant donné une proposition enregistrée, alors les pré-inscrits concernés sont retenus, dans la limite des places, et leur personnage réservé.
- [ ] Étant donné que des places manquent, alors l'écran dit qui n'a pas pu être retenu.

## Notes techniques

`server/utils/castingAssistant.ts`, `sessionAssignments.ts` (déjà passés au nouveau modèle par US-161), onglet Cast, outil MCP `proposer_casting`.

## Tests

Intégration : candidats, enregistrement, places. Playwright : onglet Cast.
