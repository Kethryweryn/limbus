---
id: US-NNN
titre: Titre
statut: à faire # à faire | en cours | terminée
epic: EPIC-NNN
regles: [] # règles de la spec couvertes (R1, R2…)
adr: []
---

# US-NNN : Titre

En tant que …, je veux …, afin de ….

## Critères d'acceptation

- [ ] Étant donné …, quand …, alors ….

## Notes techniques

Modèle de données, routes, écrans concernés.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) ; un axe qui ne s'applique pas dit pourquoi :

- Actions : …
- Erreurs de saisie : …
- Droits : …
- Hors ligne : …

Tests unitaires et d'intégration, dont `isolation.test.ts` pour toute route liée à un jeu.
