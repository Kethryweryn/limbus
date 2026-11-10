---
id: US-233
titre: Ce qui reste à traiter, par jeu et par session
statut: à faire
epic: EPIC-054
regles: [R2]
adr: []
---

# US-233 : Ce qui reste à traiter, par jeu et par session

En tant qu'organisatrice, je veux voir dans le résumé et sur chaque session ce qui reste à traiter, afin de savoir où agir sans tout ouvrir.

## Critères d'acceptation

- [ ] Étant donné une réponse modifiée non lue, une réponse attendue et un casting à annoncer, alors la ligne du jeu dit « 1 réponse modifiée · 1 réponse attendue · 1 casting à annoncer » et la ligne de chaque session dit les siens (R2).
- [ ] Étant donné un jeu sans rien à traiter, alors sa ligne n'en dit rien (R2).
- [ ] Étant donné une réponse marquée comme lue, quand je reviens au résumé, alors le nombre a baissé (R2).
- [ ] Étant donné une session terminée ou annulée, alors elle ne compte pas (R2).

## Notes techniques

- Nombres calculés par le serveur à la lecture des périodes, sans donnée nouvelle.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : chaque nombre, et sa baisse après l'action qui le traite.
- Erreurs de saisie : aucune saisie.
- Droits : un jeu sans accès ne compte pas ; la route des nombres refuse une personne sans accès (intégration).
- Hors ligne : nombres relus sans réseau, depuis la dernière lecture.
