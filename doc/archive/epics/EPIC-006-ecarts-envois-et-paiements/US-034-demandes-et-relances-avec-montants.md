---
id: US-034
titre: Demandes et relances avec le montant et le reste dû
statut: terminée
epic: EPIC-006
regles: [R17, R18]
adr: [ADR-0032]
---

# US-034 : Demandes et relances avec le montant et le reste dû

En tant qu'organisatrice, je veux que la demande de paiement et la relance donnent le montant à payer, et que la relance d'un paiement partiel rappelle le reste dû.

## Critères d'acceptation

- [x] En mode tarifs, la demande donne le tarif et le montant ; la relance rappelle le dû, le déjà reçu et le reste à payer.
- [x] Demandes et relances partent à toute personne qui doit encore quelque chose, paiement partiel compris ; une personne qui n'a rien à payer ou a tout payé n'en reçoit pas.
- [x] L'aperçu de l'email de test montre les montants de la personne choisie.
- [x] En mode simple, l'email reste celui d'aujourd'hui.

## Notes techniques

- `paymentEmailText` et `sendSessionPaymentEmails` dans `server/utils/sessionPayments.ts`.

## Tests

- Unitaires : texte avec dû, reçu et reste.
- Intégration (`sessionTariffs.test.ts`) : relance d'un paiement partiel avec le reste dû, personne à 0 € jamais destinataire.
