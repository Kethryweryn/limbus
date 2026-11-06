---
id: US-162
titre: Ouvrir une session à la pré-inscription
statut: à faire
epic: EPIC-046
regles: [R6, R8]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-162 : Ouvrir une session à la pré-inscription

En tant que organisatrice, je veux choisir quelles sessions sont proposées au vivier, afin de préparer une session sans encore la montrer.

## Critères d'acceptation

- [ ] Étant donné une session à venir, quand je l'ouvre, alors elle est proposée au vivier, avec par défaut autant de places que de personnages PJ.
- [ ] Étant donné une session terminée ou annulée, alors je ne peux pas l'ouvrir.
- [ ] Étant donné une session ouverte avec des pré-inscrits, quand je la referme, alors elle n'est plus proposée et les pré-inscriptions restent.

## Notes techniques

`RegistrationPeriodSession.open` et `seats`, reprise de `Session.poolSeats`. Outil MCP `regler_places_vivier`. Les places s'écrivent sans changer la version de la session (ADR-0036).

## Tests

Intégration : ouverture, refermeture, places. `isolation.test.ts`. Playwright : `registration.spec.ts`.
