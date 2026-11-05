---
id: US-149
titre: Trouver les nouveautés dans le menu
statut: terminée
epic: EPIC-043
regles: [R8]
adr: []
---

# US-149 : Trouver les nouveautés dans le menu

En tant que personne connectée, je veux un petit lien vers les nouveautés, afin d'y aller quand je veux sans qu'il encombre le menu.

## Critères d'acceptation

- [x] Étant donné le menu sur ordinateur, alors « Nouveautés » est en bas, séparé des autres entrées et en plus petit.
- [x] Étant donné le menu replié, alors il se réduit à une icône avec son libellé en info-bulle.
- [x] Étant donné le menu sur téléphone, alors le lien est aussi séparé et plus petit, et le suivre ferme le menu.

## Notes techniques

`components/ReleaseNotesLink.vue`, `layouts/default.vue`.

## Tests

`tests/e2e/nouveautes.spec.ts`.
