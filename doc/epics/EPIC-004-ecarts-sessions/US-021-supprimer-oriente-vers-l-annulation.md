---
id: US-021
titre: Supprimer une session oriente vers l’annulation ou le report
statut: à faire
epic: EPIC-004
regles: [R3]
adr: []
---

# US-021 : Supprimer une session oriente vers l’annulation ou le report

En tant qu'organisatrice, je veux qu'on ne puisse pas supprimer par erreur une session qui a des paiements ou des inscriptions, afin de ne pas perdre de quoi rembourser.

## Critères d'acceptation

- [ ] Supprimer une session qui a au moins un paiement reçu ou une inscription est refusé (409) : le message propose de l'annuler ou de la reporter.
- [ ] Une session sans paiement reçu ni inscription se supprime comme aujourd'hui, après confirmation.
- [ ] La page de la session propose les boutons « Annuler la session » et « Reporter » à côté du refus.

## Notes techniques

- `DELETE /api/sessions/:id` : compte `SessionPayment` avec `paidAt` et `Registration` de la session avant de supprimer.

## Tests

- Intégration : suppression refusée avec un paiement, avec une inscription ; acceptée sans.
