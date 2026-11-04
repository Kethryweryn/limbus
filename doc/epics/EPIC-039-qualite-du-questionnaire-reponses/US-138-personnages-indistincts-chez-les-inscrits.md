---
id: US-138
titre: Les personnages indistincts chez les inscrits
statut: terminée
epic: EPIC-039
regles: [R2, R7, R11]
adr: [ADR-0061, ADR-0063]
---

# US-138 : Les personnages indistincts chez les inscrits

En tant qu'organisatrice, je veux savoir quels personnages reçoivent les mêmes notes chez les inscrits, afin de changer les liens qui les confondent.

## Critères d'acceptation

- [x] Pour deux personnages PJ, Limbus calcule la corrélation de Pearson de leurs notes chez les personnes qui ont répondu à une question reliée.
- [x] La paire est « à revoir » si le test contre 0,85, corrigé par Holm, confirme, « à confirmer » si seule la valeur observée atteint 0,85.
- [x] Un personnage dont la note est la même pour tout le monde n'est pas comparé.
- [x] Le détail donne la corrélation, sa borne basse, le seuil et la référence.

## Notes techniques

- Les notes viennent de `castingScore`, comme dans l'assistant.

## Tests

- Unitaires : personnages aux notes proportionnelles, note constante, corrélation sous le seuil, correction par Holm.
