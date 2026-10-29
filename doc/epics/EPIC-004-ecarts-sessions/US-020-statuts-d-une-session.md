---
id: US-020
titre: Statuts réversibles et session terminée hors des listes courantes
statut: terminée
epic: EPIC-004
regles: [R2]
adr: []
---

# US-020 : Statuts réversibles et session terminée hors des listes courantes

En tant qu'organisatrice, je veux que le statut d'une session agisse et puisse revenir en arrière, afin de gérer une annulation levée ou une session passée.

## Critères d'acceptation

- [x] Le statut se change librement : une session annulée peut redevenir prévue (« désannulée ») ou être reportée.
- [x] Une session « Terminée » sort du tableau de bord et des prochaines sessions affichées avec les jeux, comme une session annulée ; elle reste modifiable.
- [x] Dans la liste des sessions, une session terminée ou annulée est rangée avec les sessions passées, quelle que soit sa date.
- [x] Les règles existantes restent : « Annulée » et « Terminée » empêchent d'ajouter la session à une période d'inscription.

## Notes techniques

- `server/api/dashboard/index.get.ts`, `server/api/games/index.get.ts` : exclure aussi `completed`.
- `pages/sessions/index.vue` : sections à venir et passées.

## Tests

- Unitaires (`tests/utils/domain.test.ts`) : `isClosedSessionStatus`.
- Intégration (`sessionLifecycle.test.ts`) : une session terminée n'est plus la prochaine session de son jeu ; repassée « Prévue », elle y revient.
