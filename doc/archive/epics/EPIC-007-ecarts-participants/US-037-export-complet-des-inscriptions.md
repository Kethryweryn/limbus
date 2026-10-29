---
id: US-037
titre: Export complet des inscriptions
statut: terminée
epic: EPIC-007
regles: [R7]
adr: []
---

# US-037 : Export complet des inscriptions

En tant que participant, je veux que l'export de mes données contienne tout ce qui me concerne, afin que mon droit d'accès soit complet.

## Critères d'acceptation

- [x] L'export de chaque inscription contient la date de la dernière relance.
- [x] Il contient le nom de l'organisatrice qui a invité la personne, et de celle qui l'a retirée.

## Notes techniques

- `exportParticipantData` dans `server/utils/participantPrivacy.ts`.

## Tests

- Intégration (`privacy.test.ts`) : relance, invitante et autrice du retrait dans l'export.
