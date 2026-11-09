---
id: US-199
titre: Tester chaque écran des sessions
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-199 : Tester chaque écran des sessions

En tant qu'organisatrice, je veux que la liste des sessions et chaque onglet d'une session aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [ ] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [ ] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés.

## Notes techniques

Specs : SPEC-004, SPEC-005, SPEC-006, SPEC-010. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

À compléter à la fin du lot.
