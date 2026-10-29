---
id: US-043
titre: Limbus garde toujours une administratrice
statut: à faire
epic: EPIC-008
regles: [R5]
adr: []
---

# US-043 : Limbus garde toujours une administratrice

En tant qu'administratrice, je veux qu'on ne puisse pas retirer le rôle de la dernière administratrice, afin que Limbus ne reste pas sans personne pour le gérer.

## Critères d'acceptation

- [ ] Retirer le rôle d'administratrice au dernier compte qui l'a est refusé (409), avec un message qui demande d'en nommer une autre d'abord.
- [ ] La suppression d'un compte reste refusée pour son propre compte, comme aujourd'hui : la dernière administratrice ne peut donc pas être supprimée.

## Notes techniques

- `server/api/admin/users/[id].put.ts`.

## Tests

- Intégration (`admin.test.ts`) : rôle retiré à la dernière administratrice refusé, accepté quand il en reste une autre.
