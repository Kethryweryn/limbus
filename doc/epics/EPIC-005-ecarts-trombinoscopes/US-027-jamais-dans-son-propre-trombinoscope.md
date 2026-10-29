---
id: US-027
titre: Un personnage n'apparaît jamais dans son propre trombinoscope
statut: à faire
epic: EPIC-005
regles: [R5b]
adr: []
---

# US-027 : Un personnage n'apparaît jamais dans son propre trombinoscope

En tant qu'organisatrice, je veux qu'un personnage ne figure pas dans son propre trombinoscope, sans avoir à le décocher à la main pour chaque rôle.

## Critères d'acceptation

- [ ] La configuration du trombinoscope d'un personnage ne le liste pas lui-même.
- [ ] La génération ne l'ajoute jamais à son propre trombinoscope, même si un ancien réglage l'y incluait.
- [ ] Un enregistrement de configuration qui le contient quand même ignore cette entrée.

## Notes techniques

- `getCharacterTrombinoscopeConfig`, `saveCharacterTrombinoscopeConfig` et la génération dans `server/utils/trombinoscopes.ts`. Les anciens réglages de soi-même restent en base sans effet.

## Tests

- Unitaires (`tests/server/trombinoscopes.test.ts`) : le personnage qui regarde est absent des entrées.
- Intégration (`trombinoscopes.test.ts`) : configuration sans soi-même ; entrée de soi-même ignorée à l'enregistrement.
