---
id: US-023
titre: Suivre les remboursements d’une session annulée ou reportée
statut: terminée
epic: EPIC-004
regles: [R2]
adr: [ADR-0029]
---

# US-023 : Suivre les remboursements d’une session annulée ou reportée

En tant qu'organisatrice, je veux décider pour chaque personne qui a payé une session annulée ou reportée si je la rembourse ou si son paiement passe sur la nouvelle date, afin de ne rien oublier.

## Critères d'acceptation

- [x] Pour une session annulée ou reportée, l'onglet Paiements liste les personnes qui ont payé, avec un choix : à rembourser, remboursé (avec la date), ou reporté sur la nouvelle session (session reportée seulement).
- [x] « Reporté » marque la personne comme ayant payé sur la nouvelle session, avec la date de paiement d'origine, si elle fait partie de son tableau des paiements. Revenir ensuite sur ce choix ne retire pas le paiement de la nouvelle session : on le corrige depuis celle-ci.
- [x] Un décompte indique combien de remboursements restent à faire.
- [x] Ces choix sont inclus dans l'export des données de la personne et supprimés avec elle.

## Notes techniques

- `SessionPayment.refundStatus`, `refundedAt`, `carriedOverToSessionId` : ajouts seuls.
- Route `PUT /api/sessions/:id/payments/:participantId/refund` ; `exportParticipantData` ; `isolation.test.ts`.

## Tests

- Intégration (`sessionLifecycle.test.ts`) : refus sur une session prévue ; remboursé (avec la date), reporté (paiement créé sur la nouvelle session, date d'origine) ; tableau des remboursements ; export ; refus du report sans session de report et pour une personne qui n'a pas payé.
- Isolation (`isolation.test.ts`) : remboursement d'un paiement de Bob refusé.
