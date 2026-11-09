---
id: US-201
titre: Tester les écrans du compte, de l'accès et de l'administration
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-201 : Tester les écrans du compte, de l'accès et de l'administration

En tant qu'organisatrice, je veux que l'inscription libre, le compte, les invitations et l'administration aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [ ] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [ ] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés.

## Notes techniques

Specs : SPEC-008, SPEC-011, SPEC-013. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

À compléter à la fin du lot.
