---
id: US-032
titre: Noter les versements, état de paiement calculé
statut: terminée
epic: EPIC-006
regles: [R15]
adr: [ADR-0032]
---

# US-032 : Noter les versements, état de paiement calculé

En tant qu'organisatrice, je veux noter chaque versement reçu, même partiel, et voir ce que chaque personne doit encore.

## Critères d'acceptation

- [x] En mode tarifs, l'organisatrice ajoute un versement (montant, date) à une personne, et peut en supprimer un.
- [x] Le tableau montre pour chaque personne son tarif, le dû, le reçu et le reste, et un état calculé : payé, partiel, non payé ou rien à payer.
- [x] Il n'y a plus de case « payé » en mode tarifs ; un paiement validé en mode simple reste compté comme payé.
- [x] Les totaux de la session (dû, reçu, reste) sont affichés.
- [x] Les remboursements, le report d'un paiement sur la nouvelle session et la suppression d'une session tiennent compte des versements.
- [x] Export et effacement RGPD couvrent tarifs choisis et versements.

## Notes techniques

- Table `SessionPaymentInstalment` ; routes `POST /api/sessions/:id/payments/:participantId/instalments` et `DELETE …/instalments/:instalmentId` ; ajoutées à `isolation.test.ts`.

## Tests

- Unitaires (`tests/server/sessionTariffs.test.ts`) : état calculé (payé, partiel, non payé, rien à payer, ancien paiement validé).
- Intégration (`sessionTariffs.test.ts`) : versements, état, refus d'un versement à une personne hors du tableau, export RGPD.
