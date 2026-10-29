---
id: US-039
titre: Paiement d'une personne qui part : rembourser, garder ou transférer
statut: terminée
epic: EPIC-007
regles: [R16]
adr: [ADR-0033]
---

# US-039 : Paiement d'une personne qui part : rembourser, garder ou transférer

En tant qu'organisatrice, je veux décider du paiement d'une personne qui se désiste ou est retirée : la rembourser, le garder, ou le reporter sur la personne qui reprend sa place.

## Critères d'acceptation

- [x] Le paiement reçu d'une personne qui n'est plus dans le tableau reste affiché à part, avec son montant.
- [x] L'organisatrice choisit « à rembourser », « remboursé », « gardé, non remboursé » ou « transféré au remplaçant » ; tant qu'elle n'a rien choisi, la proposition suit la date limite de désistement ([US-040](US-040-date-limite-de-desistement.md)).
- [x] « Transféré » demande une personne du tableau : le montant reçu compte comme payé par elle (un versement en mode tarifs, la case « payé » en mode simple).
- [x] Revenir sur un transfert ne retire pas le paiement de la personne qui l'a reçu : on le corrige depuis sa ligne.

## Notes techniques

- Statuts `kept` et `transferred` ajoutés à `REFUND_STATUSES` ; colonne `SessionPayment.transferredToParticipantId` ([ADR-0033](../../adr/ADR-0033-paiement-d-une-personne-qui-part.md)).
- Route `PUT /api/sessions/:id/payments/:participantId/departure` ; ajoutée à `isolation.test.ts`.

## Tests

- Intégration (`sessionTariffs.test.ts`) : gardé, remboursé, transfert en mode tarifs et en mode simple, refus pour une personne encore dans le tableau.
