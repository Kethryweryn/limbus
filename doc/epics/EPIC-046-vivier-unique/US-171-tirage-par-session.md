---
id: US-171
titre: Tirer au sort pour une session
statut: à faire
epic: EPIC-046
regles: [R22, R23]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-171 : Tirer au sort pour une session

En tant que organisatrice, je veux choisir le mode de sélection de chaque session, afin de tirer au sort parmi ses pré-inscrits.

## Critères d'acceptation

- [ ] Étant donné une session au hasard ou mixte, quand je lance le tirage, alors il porte sur ses pré-inscrits, hors rejoueurs exclus.
- [ ] Étant donné la limite de liste d'attente, alors les personnes au-delà restent pré-inscrites, sans message.
- [ ] Étant donné un tirage sans annonce depuis, quand je l'annule, alors la session revient à son état d'avant.
- [ ] Étant donné la même graine et les mêmes entrées, alors le résultat est identique.

## Notes techniques

`RegistrationDraw.sessionId`, réglages sur `RegistrationPeriodSession`. `server/utils/registrationDraws.ts`, routes `registration-periods/[id]/draws` et `registration-draws`, outils MCP `tirer_au_sort` et `annuler_tirage`.

## Tests

Unitaire : `utils/registrationDraw`. Intégration : `registrationDraws.test.ts`. Playwright : sélection.
