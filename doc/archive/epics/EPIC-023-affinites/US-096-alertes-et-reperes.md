---
id: US-096
titre: Alertes et repères d'affinités dans la sélection
statut: terminée
epic: EPIC-023
regles: [R25]
adr: [ADR-0049]
---

# US-096 : Alertes et repères d'affinités dans la sélection

En tant qu'organisatrice, je veux voir, en répartissant les inscriptions entre les sessions, quelles personnes ne veulent pas se croiser et qui veut jouer avec qui.

## Critères d'acceptation

- [x] Quand une personne retenue ou confirmée pour une session ne veut pas croiser, ou ne veut pas jouer avec, une personne rattachée présente dans la même session (retenue, confirmée ou dans le cast), la session affiche une alerte qui nomme les deux personnes, et chacune porte un badge.
- [x] L'alerte prévient sans bloquer : la décision est enregistrée.
- [x] Le tirage au sort n'en tient pas compte ; ses alertes apparaissent ensuite dans la sélection.
- [x] À côté d'une inscription, chaque personne souhaitée (« avec qui je veux jouer ») et rattachée est indiquée : présente dans la même session, dans une autre (laquelle), ou pas encore.

## Notes techniques

- Alertes et repères calculés par `selectionOverview` (`GET /api/registration-periods/:id/selection`).

## Tests

- Intégration : alerte entre deux retenues, alerte avec le cast, pas d'alerte entre sessions différentes, repère « ailleurs ».
