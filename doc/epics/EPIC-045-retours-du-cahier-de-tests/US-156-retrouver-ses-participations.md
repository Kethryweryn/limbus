---
id: US-156
titre: Retrouver ses participations depuis l'organisation
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-156 : Retrouver ses participations depuis l'organisation

En tant que personne qui ne fait que participer, je veux arriver sur « Je participe » et pouvoir toujours y revenir, afin de ne pas rester bloquée côté organisation (test A4 du cahier).

## Critères d'acceptation

- [x] Étant donné le choix d'espace d'un autre compte sur le même appareil, quand je me connecte, alors il ne s'applique pas à moi.
- [x] Étant donné que je ne fais que participer, quand je suis sur « Je participe », alors le sélecteur reste caché.
- [x] Étant donné que j'ai ouvert « Organiser un GN », alors le sélecteur me permet de revenir à « Je participe ».
- [x] Étant donné une déconnexion, alors le choix d'espace est oublié sur l'appareil.

## Notes techniques

`utils/spaces.ts` : l'espace est gardé avec l'identifiant du compte, et l'ancien format est ignoré. `layouts/default.vue`, `pages/index.vue`, `pages/participer/index.vue`, `utils/storage.ts`. [SPEC-011](../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) mise à jour.

## Tests

`tests/utils/spaces.test.ts`, `tests/e2e/participate.spec.ts`, `tests/e2e/auth.spec.ts`.
