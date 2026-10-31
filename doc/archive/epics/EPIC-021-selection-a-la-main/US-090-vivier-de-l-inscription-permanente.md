---
id: US-090
titre: Choisir dans le vivier de l'inscription permanente
statut: terminée
epic: EPIC-021
regles: [R5, R7, R30, R31]
adr: [ADR-0047]
---

# US-090 : Choisir dans le vivier de l'inscription permanente

En tant qu'organisatrice, je veux choisir dans le vivier de l'inscription permanente les personnes d'une session à venir, afin de remplir chaque session sans rouvrir d'inscriptions.

## Critères d'acceptation

- [x] Le vivier montre les sessions à venir du jeu qui n'ont pas de période dédiée, avec leurs places (par défaut le nombre de personnages PJ, modifiables).
- [x] L'équipe retient ou met en attente des personnes du vivier pour une session ; les autres restent dans le vivier sans email.
- [x] Une personne retenue pour une session ne peut pas l'être pour une autre en même temps.
- [x] Après une session terminée ou annulée, la personne revient au vivier ; si les rejoueurs sont exclus et qu'elle a joué, elle n'y revient pas.
- [x] Rattacher à une période dédiée une session où des personnes du vivier sont retenues, confirmées ou en attente est refusé.

## Notes techniques

- `Session.poolSeats` ; `PUT /api/registration-periods/:id/pool-seats` ; refus R31 dans `resolveRegistrationPeriodSessions`.

## Tests

- Intégration : retenir dans le vivier, places, retour au vivier après la session, rejoueur exclu, refus R31.
