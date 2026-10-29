---
id: US-025
titre: Prévenir l’équipe de l’annulation d’une session
statut: à faire
epic: EPIC-004
regles: [R2]
adr: []
---

# US-025 : Prévenir l’équipe de l’annulation d’une session

En tant qu'organisatrice, je veux envoyer un email à toute l'équipe quand une session est annulée, après l'avoir relu, afin de prévenir tout le monde en une fois.

## Critères d'acceptation

- [ ] Quand une session passe à « Annulée », Limbus propose un email d'annulation : un aperçu modifiable (objet et texte), envoyé à toutes les personnes de l'équipe qui ont un email.
- [ ] L'organisation peut l'envoyer, ou fermer sans rien envoyer ; elle peut aussi le proposer à nouveau depuis la session.
- [ ] Un échec d'envoi à une personne n'arrête pas les autres : les personnes qui n'ont rien reçu sont listées.
- [ ] Un email de test est possible, comme pour les autres envois.

## Notes techniques

- Route `POST /api/sessions/:id/cancellation-email` (action), verrou d'envoi et limite de débit comme les autres envois ([SPEC-006](../../specs/SPEC-006-emails-et-paiements.md)) ; `isolation.test.ts`.

## Tests

- Intégration : envoi à l'équipe, échecs listés, refus sur une session non annulée, isolation.
