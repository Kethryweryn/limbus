---
id: US-021
titre: Supprimer une session oriente vers l’annulation ou le report
statut: terminée
epic: EPIC-004
regles: [R3]
adr: []
---

# US-021 : Supprimer une session oriente vers l’annulation ou le report

En tant qu'organisatrice, je veux qu'on ne puisse pas supprimer par erreur une session qui a des paiements ou des inscriptions, afin de ne pas perdre de quoi rembourser.

## Critères d'acceptation

- [x] Supprimer une session qui a au moins un paiement reçu ou une inscription est refusé (409) : le message propose de l'annuler ou de la reporter.
- [x] Une session sans paiement reçu ni inscription se supprime comme aujourd'hui, après confirmation.
- [x] Le refus s'affiche dans la liste des sessions et renvoie à la page de la session, où l'on change le statut pour l'annuler, ou bien où l'on clique « Reporter » (US-022).

## Notes techniques

- `DELETE /api/sessions/:id` : compte `SessionPayment` avec `paidAt` et `Registration` de la session avant de supprimer.

## Tests

- Intégration (`sessionLifecycle.test.ts`) : suppression refusée avec un paiement reçu, avec une inscription ; acceptée avec un paiement seulement demandé.
