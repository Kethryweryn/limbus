---
id: US-162
titre: Ouvrir une session à la pré-inscription
statut: terminée
epic: EPIC-046
regles: [R6, R8]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-162 : Ouvrir une session à la pré-inscription

En tant que organisatrice, je veux choisir quelles sessions sont proposées au vivier, afin de préparer une session sans encore la montrer.

## Critères d'acceptation

- [x] Étant donné une session à venir, quand je l'ouvre, alors elle est proposée au vivier, avec autant de places que de personnages PJ du jeu, sans réglage.
- [x] Étant donné une session terminée, annulée ou sans date, alors je ne peux pas l'ouvrir.
- [x] Étant donné une session ouverte, quand je retire sa date, alors elle est refermée.
- [x] Étant donné une session ouverte dont la date passe, ou annulée, alors elle n'est plus proposée ni relancée, sans autre action.
- [x] Étant donné une session ouverte avec des pré-inscrits, quand je la referme, alors elle n'est plus proposée, les pré-inscriptions restent, et je peux continuer le casting.

## Notes techniques

`RegistrationPeriodSession.open`, évalué à la lecture avec la date et le statut (ADR-0020). Les places se calculent par `countPlayableCharacters` ; `seats`, `poolSeats` et l'outil MCP `regler_places_vivier` disparaissent, et les écrans de places aussi.

## Tests

Intégration : `registrationPeriods.test.ts`, `isolation.test.ts`. Unitaire : `tests/utils/registrationPeriods.test.ts`. Playwright : `registrationActions.spec.ts`.
