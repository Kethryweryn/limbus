---
id: US-031
titre: Tarifs d'une session, attribués selon le rôle
statut: terminée
epic: EPIC-006
regles: [R14, R15]
adr: [ADR-0032]
---

# US-031 : Tarifs d'une session, attribués selon le rôle

En tant qu'organisatrice, je veux définir les tarifs de la PAF d'une session et que chaque personne reçoive celui de son rôle, afin de savoir ce que chacune doit.

## Critères d'acceptation

- [x] L'onglet Paiements permet de créer, modifier et supprimer des tarifs : nom, montant en euros, rôle par défaut facultatif (PJ, PNJ, orga, cuisine), un seul tarif par rôle.
- [x] Chaque personne a le tarif de son rôle ; l'organisatrice peut lui en choisir un autre, ou revenir au tarif de son rôle.
- [x] Dès qu'un tarif existe, toute l'équipe de la session est dans le tableau, orgas et cuisine compris ; un dû nul s'affiche « rien à payer ».
- [x] Sans tarif, le tableau reste en mode simple, comme aujourd'hui.

## Notes techniques

- Table `SessionTariff`, colonne `SessionPayment.tariffId` ([ADR-0032](../../../adr/ADR-0032-tarifs-et-versements.md)).
- Routes `POST /api/sessions/:id/tariffs`, `PUT` et `DELETE /api/sessions/:id/tariffs/:tariffId`, et le choix du tarif par `PUT /api/sessions/:id/payments/:participantId/tariff` ; ajoutées à `isolation.test.ts`.

## Tests

- Unitaires (`tests/server/sessionTariffs.test.ts`) : tarif selon le rôle, choix manuel, personne sans tarif.
- Intégration (`sessionTariffs.test.ts`) : création, un seul tarif par rôle, orgas et cuisine dans le tableau, mode simple sans tarif.
