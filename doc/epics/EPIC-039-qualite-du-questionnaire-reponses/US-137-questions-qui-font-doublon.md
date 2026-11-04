---
id: US-137
titre: Les questions qui font doublon
statut: terminée
epic: EPIC-039
regles: [R2, R7, R10]
adr: [ADR-0061, ADR-0063]
---

# US-137 : Les questions qui font doublon

En tant qu'organisatrice, je veux savoir quelles questions disent la même chose, afin d'en retirer une ou de les différencier.

## Critères d'acceptation

- [x] Deux questions reliées, à choix unique ou échelles, sont comparées sur les personnes qui ont répondu aux deux. Une question à laquelle ces personnes ont toutes répondu pareil n'est pas comparée.
- [x] Entre deux échelles : corrélation de Spearman en valeur absolue, « à revoir » si la borne basse dépasse 0,50, « à confirmer » si seule la valeur la dépasse.
- [x] Sinon : V de Cramér corrigé, « à revoir » s'il atteint le seuil de Cohen, que les conditions de Cochran sont remplies et que le test contre le seuil confirme, « à confirmer » s'il l'atteint sans le reste. Sous le seuil, rien n'est affiché.
- [x] Les valeurs p sont corrigées par la méthode de Holm.
- [x] La phrase donne la réponse la plus liée, avec ses comptes.

## Notes techniques

- La réponse la plus liée est la case dont le résidu de Pearson est le plus grand.

## Tests

- Unitaires : V corrigé, khi-deux non central et Holm contre des valeurs de référence ; paire constante ignorée ; conditions de Cochran non remplies ; corrélation négative entre échelles ; 3 réponses ou moins.
