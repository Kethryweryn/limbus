---
id: US-087
titre: Retenir, mettre en attente ou écarter une inscription
statut: terminée
epic: EPIC-021
regles: [R5, R7, R16, R19]
adr: [ADR-0047]
---

# US-087 : Retenir, mettre en attente ou écarter une inscription

En tant qu'organisatrice d'une période en mode formulaire, je veux trier les inscriptions reçues, session par session, afin de constituer la distribution de chaque session.

## Critères d'acceptation

- [x] Une inscription reçue se retient pour une session de la période où elle est disponible (la seule session d'une période qui n'en a qu'une).
- [x] Retenir au-delà des places de la session est refusé ; le compteur montre les retenues et confirmées face aux places.
- [x] Une inscription se met en liste d'attente d'une ou plusieurs sessions ; chaque file se réordonne ; la retenir dans une session la retire de toutes les files.
- [x] Une inscription se marque « non retenue », ou se remet à trier ; on peut changer d'avis tant que la personne n'a pas confirmé.
- [x] La période a un réglage des rejoueurs : autorisés, signalés ou exclus du tirage. Signalés ou exclus, une personne qui a déjà joué le jeu (session terminée) porte la mention « a déjà joué ».
- [x] Aucune décision ne prévient la personne : elle est « à annoncer » (US-088).

## Notes techniques

- Statuts `retained`, `waitlisted`, `rejected` ; `RegistrationWaitlistEntry` ; `RegistrationPeriod.replayPolicy`.
- `POST /api/registrations/:id/selection`, `PUT /api/registration-periods/:id/waitlist`.

## Tests

- Intégration : retenir, places dépassées refusées, session hors disponibilités refusée, files multiples, ordre, non retenue, remise à trier, rejoueur signalé ; isolation des nouvelles routes.
