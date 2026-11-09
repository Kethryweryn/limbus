---
id: US-211
titre: Supprimer un participant depuis sa fiche, et voir pourquoi c'est refusé
statut: terminée
epic: EPIC-050
regles: [R9]
adr: []
---

# US-211 : Supprimer un participant depuis sa fiche, et voir pourquoi c'est refusé

En tant qu'organisatrice, je veux supprimer une fiche participant depuis la fiche elle-même, et lire le refus quand elle est liée au jeu d'une autre équipe, afin de ne pas rester sans réponse (écarts trouvés en écrivant les tests de l'US-200).

## Critères d'acceptation

- [x] La fiche d'un participant propose « Supprimer », avec la même confirmation que la liste, puis revient à la liste.
- [x] Depuis la liste comme depuis la fiche, une fiche liée au jeu d'une autre équipe est refusée avec le message « Ce participant est lié à des jeux auxquels vous n’avez pas accès » (R9) ; avant, la liste ne disait rien.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09. `pages/participants/[slug].vue` passe par `SheetDeleteButton` ; `pages/participants/index.vue` par `confirmedDelete`, avec le refus au-dessus de la liste ; la confirmation est `DELETE_CONFIRMATIONS.participant`.

## Tests

`tests/e2e/participantScreens.spec.ts` : suppression refusée (liste et fiche), puis faite depuis la fiche.
