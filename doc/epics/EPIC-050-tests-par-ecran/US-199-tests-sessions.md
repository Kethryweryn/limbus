---
id: US-199
titre: Tester chaque écran des sessions
statut: en cours
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

## Avancement

Le lot se livre en deux PR.

- **Première PR (faite)** : liste des sessions (parties à venir et passées, période, recherche, pages), carte et suppression (US-209), détails (nom vide, lieu du même jeu, statut, page publique), cast (PNJ, réglage « un seul PJ », « Aucun participant »), déroulé (responsables), droits, création hors ligne. Défaut trouvé : la carte, le bouton « Organisation » et la suppression depuis la fiche ([US-209](US-209-carte-et-fiche-d-une-session.md)) ; le formulaire de session avait le même `required` que ceux de l'écriture ([US-204](US-204-champ-obligatoire-explique.md)).
- **Seconde PR (à faire)** : trombinoscopes et PDF (avec les réglages d'un personnage et l'étiquette d'un groupe, reportés de l'US-198), documents et envois (avec « prêt à envoyer »), paiements, présence.

## Tests

`tests/e2e/sessionScreens.spec.ts` : 7 tests.
