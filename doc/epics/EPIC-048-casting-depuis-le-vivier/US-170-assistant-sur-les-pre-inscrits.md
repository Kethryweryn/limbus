---
id: US-170
titre: Proposer le casting parmi les pré-inscrits
statut: terminée
epic: EPIC-048
regles: [R21]
adr: []
---

# US-170 : Proposer le casting parmi les pré-inscrits

En tant que organisatrice, je veux que l'assistant propose des personnages aux pré-inscrits, afin de faire le casting à partir des personnes disponibles.

## Critères d'acceptation

- [x] Étant donné une session, quand je lance l'assistant, alors il répartit le cast, les personnes retenues et les pré-inscrits, sans les autres personnes du vivier.
- [x] Étant donné une personne ajoutée à la main, alors elle entre dans les propositions.
- [x] Étant donné une proposition enregistrée, alors les pré-inscrits concernés sont retenus, dans la limite des places, et leur personnage réservé.
- [x] Étant donné que des places manquent, alors l'écran dit qui n'a pas pu être retenu.

## Notes techniques

`server/utils/castingAssistant.ts`, `manualRetainRoom` dans `registrationSelection.ts` : la marge suit les places et le mode de sélection, et une session au hasard sans tirage n'a aucune marge. La proposition reste une proposition : la réservation et la retenue partent de l'enregistrement du cast (US-176). Outil MCP `proposer_casting` : il propose, `decider_inscription` retient.

## Tests

Intégration : `tests/integration/castPlayers.test.ts` (candidats, enregistrement, places, mode hasard). Playwright : `tests/e2e/castingAssistant.spec.ts`.
