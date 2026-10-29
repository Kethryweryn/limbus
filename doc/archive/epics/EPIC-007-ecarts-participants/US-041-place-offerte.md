---
id: US-041
titre: Place offerte
statut: terminée
epic: EPIC-007
regles: [R15]
adr: []
---

# US-041 : Place offerte

En tant qu'organisatrice, je veux offrir sa place à une personne, par exemple un remplaçant de dernière minute, sans créer de tarif.

## Critères d'acceptation

- [x] Une case « place offerte » par personne du tableau ; cochée, le dû de la personne est 0 € et son état « place offerte », en mode simple comme en mode tarifs.
- [x] Une personne dont la place est offerte ne reçoit ni demande ni relance.

## Notes techniques

- Colonne `SessionPayment.offered Boolean @default(false)` ; route `PUT /api/sessions/:id/payments/:participantId/offered` ; ajoutée à `isolation.test.ts`.

## Tests

- Unitaires : état « place offerte ».
- Intégration (`sessionTariffs.test.ts`) : place offerte hors des envois, dû nul.
