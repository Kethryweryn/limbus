---
id: US-025
titre: Prévenir l’équipe de l’annulation d’une session
statut: terminée
epic: EPIC-004
regles: [R2]
adr: []
---

# US-025 : Prévenir l’équipe de l’annulation d’une session

En tant qu'organisatrice, je veux envoyer un email à toute l'équipe quand une session est annulée, après l'avoir relu, afin de prévenir tout le monde en une fois.

## Critères d'acceptation

- [x] Quand une session passe à « Annulée » depuis sa page, Limbus propose un email d'annulation : un aperçu modifiable (objet et texte), envoyé une fois à chaque personne de l'équipe qui a un email ; les personnes sans email sont listées.
- [x] L'organisation peut l'envoyer, ou fermer sans rien envoyer ; le bouton « Prévenir l'équipe » d'une session annulée le propose à nouveau.
- [x] Un échec d'envoi à une personne n'arrête pas les autres : les personnes qui n'ont rien reçu sont listées.
- [x] Un email de test est possible, comme pour les autres envois.

## Notes techniques

- Route `POST /api/sessions/:id/cancellation-email` (action), verrou d'envoi et limite de débit comme les autres envois ([SPEC-006](../../../specs/SPEC-006-emails-et-paiements.md)) ; `isolation.test.ts`.

## Tests

- Intégration (`sessionCancellation.test.ts`) : envoi une fois par personne de l'équipe avec le texte relu, personnes sans email listées, refus sur une session non annulée, test aux adresses choisies.
- Isolation (`isolation.test.ts`) : envoi et test refusés sur une session de Bob.
