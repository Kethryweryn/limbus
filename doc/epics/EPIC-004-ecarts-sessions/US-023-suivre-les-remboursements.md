---
id: US-023
titre: Suivre les remboursements d’une session annulée ou reportée
statut: à faire
epic: EPIC-004
regles: [R2]
adr: [ADR-0029]
---

# US-023 : Suivre les remboursements d’une session annulée ou reportée

En tant qu'organisatrice, je veux décider pour chaque personne qui a payé une session annulée ou reportée si je la rembourse ou si son paiement passe sur la nouvelle date, afin de ne rien oublier.

## Critères d'acceptation

- [ ] Pour une session annulée ou reportée, l'onglet Paiements liste les personnes qui ont payé, avec un choix : à rembourser, remboursé (avec la date), ou reporté sur la nouvelle session (session reportée seulement).
- [ ] « Reporté » marque la personne comme ayant payé sur la nouvelle session, avec la date de paiement d'origine, si elle fait partie de son tableau des paiements.
- [ ] Un décompte indique combien de remboursements restent à faire.
- [ ] Ces choix sont inclus dans l'export des données de la personne et supprimés avec elle.

## Notes techniques

- `SessionPayment.refundStatus`, `refundedAt`, `carriedOverToSessionId` : ajouts seuls.
- Route `PUT /api/sessions/:id/payments/:participantId/refund` ; `exportParticipantData` ; `isolation.test.ts`.

## Tests

- Intégration : à rembourser, remboursé, reporté (paiement créé sur la nouvelle session) ; refus du report sans session cible ; isolation ; export.
