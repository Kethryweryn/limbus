---
id: US-089
titre: Confirmer sa place, et proposer la suivante quand une place se libère
statut: terminée
epic: EPIC-021
regles: [R20, R21, R22]
adr: [ADR-0020, ADR-0047]
---

# US-089 : Confirmer sa place, et proposer la suivante quand une place se libère

En tant que personne retenue, je veux confirmer ma place d'un bouton ; en tant qu'organisatrice, je veux redonner une place libérée à la suivante de la liste d'attente.

## Critères d'acceptation

- [x] Par son lien personnel ou son compte, une personne retenue clique sur « Je confirme ma place » : elle devient participante de la session et entre dans les paiements.
- [x] Elle peut aussi se désister ; une personne en attente peut quitter la liste d'attente.
- [x] Passé l'échéance, l'équipe voit « délai dépassé » ; elle relance, prolonge ou libère la place, comme pour une invitation. Tant que la place n'est pas libérée, la personne peut encore confirmer.
- [x] Quand une place se libère (libération, désistement), la file de la session propose sa première personne ; l'équipe la retient, puis l'annonce.

## Notes techniques

- `POST /api/public/registrations/:token/accept`, `POST /api/me/registrations/:id/accept` ; relance, prolongation et libération étendues aux personnes retenues.

## Tests

- Intégration : confirmation et `SessionParticipant`, refus avant l'annonce, désistement, délai dépassé puis libération, proposition de la suivante.
- Bout en bout : trier, annoncer, confirmer par le lien.
