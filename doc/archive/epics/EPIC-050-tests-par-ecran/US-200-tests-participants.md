---
id: US-200
titre: Tester chaque écran des participants
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-200 : Tester chaque écran des participants

En tant qu'organisatrice, je veux que la liste et la fiche des participants aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés : [US-211](US-211-supprimer-un-participant-depuis-sa-fiche.md), [US-212](US-212-fiches-hors-ligne.md) ; le formulaire perd son `required` ([US-204](US-204-champ-obligatoire-explique.md)).

## Notes techniques

Specs : SPEC-007, SPEC-011, SPEC-010. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

- `tests/e2e/participantScreens.spec.ts` : liste (recherche par nom et email, filtre, pages, création sans nom ni jeu), fiche (jeux ajoutés et retirés, notes par jeu, dernier jeu retiré), coordonnées tenues par la personne, export limité aux jeux de l'organisatrice, suppression (US-211), droits et conflit, modification hors ligne.
- `tests/e2e/offlineSheets.spec.ts` : toutes les fiches hors ligne (US-212).
