---
id: US-148
titre: Donner le numéro du déploiement
statut: terminée
epic: EPIC-043
regles: [R7]
adr: [ADR-0065]
---

# US-148 : Donner le numéro du déploiement

En tant que personne qui signale un problème, je veux trouver le numéro de ce qui tourne, afin que l'équipe retrouve exactement ce déploiement.

## Critères d'acceptation

- [x] Étant donné un build de pull request, alors la page affiche « Déploiement n° N », avec le numéro de cette pull request.
- [x] Étant donné un build sur `main`, alors le numéro vient du titre du dernier commit (`(#N)`).
- [x] Étant donné un build sans numéro connu, alors le texte n'apparaît pas.

## Notes techniques

`NOUVEAUTES_PR` donné par la CI ; repli sur le titre du commit dans `modules/releaseNotes/notes.ts`.

## Tests

`tests/modules/releaseNotes.test.ts` ; `tests/e2e/nouveautes.spec.ts` vérifie le texte quand il tourne dans une pull request.
