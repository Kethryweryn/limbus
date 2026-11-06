---
id: US-177
titre: Retrouver « Mes photos » dans mon compte
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-177 : Retrouver « Mes photos » dans mon compte

En tant que personne qui participe, je veux régler l'usage de ma photo dans « Mon compte », afin que ce réglage exceptionnel n'occupe pas le haut de « Je participe » (test A4 du cahier, retour A4-2).

## Critères d'acceptation

- [x] Étant donné « Je participe », alors la carte « Mes photos » n'y est plus.
- [x] Étant donné « Mon compte » avec une fiche chez une équipe, alors la carte « Mes photos » s'y trouve et permet de retirer ses photos, puis de les accepter de nouveau.
- [x] Étant donné « Mon compte » sans aucune fiche, alors la carte n'apparaît pas.

## Notes techniques

`components/AccountPhotosCard.vue`, `pages/compte.vue`, `pages/participer/index.vue`, `server/api/me/photo-refusal.get.ts`. [SPEC-012](../../specs/SPEC-012-photos-des-participants.md), P4.

## Tests

`tests/e2e/account.spec.ts`, `tests/integration/participantPhotos.test.ts`.
