---
id: US-060
titre: Transférer un jeu à une co-organisatrice
statut: à faire
epic: EPIC-012
regles: [R3]
adr: [ADR-0038]
---

# US-060 : Transférer un jeu à une co-organisatrice

En tant que propriétaire, je veux donner mon jeu (et non une copie) à une co-organisatrice.

## Critères d'acceptation

- [ ] Sur la fiche du jeu, la propriétaire propose le transfert à l'une de ses co-organisatrices ; elle peut retirer sa proposition.
- [ ] La co-organisatrice voit la proposition sur la fiche du jeu et l'accepte ou la refuse.
- [ ] À l'acceptation, elle devient propriétaire ; l'ancienne propriétaire devient co-organisatrice.
- [ ] Une copie léguée en attente ne se transfère pas ; le message de suppression d'un compte qui possède des jeux renvoie au transfert.

## Notes techniques

- Colonne `Game.transferToUserId` (proposition en cours), migration sans risque pour le build en service.
- Routes `POST` et `DELETE /api/games/:id/transfer`, `POST /api/games/:id/transfer/accept`.

## Tests

- Intégration : proposition, refus, retrait, acceptation (propriété et partages échangés) ; seule la destinataire accepte ; isolation des nouvelles routes.
