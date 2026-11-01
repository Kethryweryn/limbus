---
id: US-099
titre: Cocher les relations que l'on ne veut pas jouer
statut: terminée
epic: EPIC-024
regles: [R8, R28]
adr: [ADR-0050]
---

# US-099 : Cocher les relations que l'on ne veut pas jouer

En tant qu'inscrit, je veux cocher les types de relations que je ne veux pas jouer, pour que l'équipe et l'assistant de casting en tiennent compte.

## Critères d'acceptation

- [x] Quand le formulaire demande « les relations que je ne veux pas jouer », la personne coche parmi romance, famille, rivalité, alliance et hiérarchie, et peut préciser en texte libre.
- [x] Une case « Aucune, tout me va » s'exclut avec les autres ; quand la question est obligatoire, une case ou une ligne de texte suffit.
- [x] L'équipe voit les cases cochées dans le détail de l'inscription ; l'export les contient.

## Notes techniques

- Les cases sont des lignes d'affinité de sorte `refusedRelationTypes`, dont le texte est le type.

## Tests

- Unitaires : schéma des réponses (case « Aucune » exclusive, obligation).
- Intégration : enregistrement et relecture.
