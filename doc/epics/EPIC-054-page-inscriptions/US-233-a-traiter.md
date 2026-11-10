---
id: US-233
titre: Ce qui reste à traiter, par jeu et par session
statut: terminée
epic: EPIC-054
regles: [R2]
adr: []
---

# US-233 : Ce qui reste à traiter, par jeu et par session

En tant qu'organisatrice, je veux voir dans le résumé et sur chaque session ce qui reste à traiter, afin de savoir où agir sans tout ouvrir.

## Critères d'acceptation

- [x] Étant donné une réponse modifiée non lue, une réponse attendue et un casting à annoncer, alors la ligne du jeu dit « 1 réponse modifiée · 1 réponse attendue · 1 casting à annoncer » et la ligne de chaque session dit les siens (R2).
- [x] Étant donné un jeu sans rien à traiter, alors sa ligne n'en dit rien (R2).
- [x] Étant donné une réponse marquée comme lue, quand je reviens au résumé, alors le nombre a baissé (R2).
- [x] Étant donné une session terminée ou annulée, alors elle ne compte pas (R2).

## Notes techniques

- `toHandleBySession`, `sumToHandle` et `toHandleText` (`utils/registrations.ts`), sur ce que la page lit déjà : les inscriptions du vivier et leurs lignes, avec les sessions prévues du vivier (résumé) ou de la sélection (ligne de session). Aucune route nouvelle ; les nombres se relisent donc hors ligne comme le reste.
- Une réponse modifiée ne compte que pour une personne placée, la seule qui a « Marquer comme lu ».

## Tests

De bout en bout (`tests/e2e/registrationToHandle.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « le résumé et la ligne de la session le disent ; marquer comme lu le fait baisser ; un jeu sans rien n’en dit rien ».
- Erreurs de saisie : aucune saisie.
- Droits : « une organisatrice sans accès ne voit pas le jeu ni ses nombres ; une co-organisatrice les voit ». Pas de route nouvelle à ajouter à l'isolation.
- Hors ligne : « hors ligne, les nombres se relisent depuis la dernière lecture ».

Unitaires : `tests/utils/registrations.test.ts` (« ce qui reste à traiter »).
