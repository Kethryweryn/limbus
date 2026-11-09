---
id: US-203
titre: Tester chaque règle des inscriptions
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-203 : Tester chaque règle des inscriptions

En tant qu'organisatrice, je veux que les écrans des inscriptions, règle par règle aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [ ] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [ ] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés.

## Notes techniques

Specs : SPEC-001, SPEC-015, SPEC-016, SPEC-018. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

À compléter à la fin du lot.
