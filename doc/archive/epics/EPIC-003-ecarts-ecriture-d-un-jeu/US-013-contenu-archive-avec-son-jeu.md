---
id: US-013
titre: Le contenu d'un jeu archivé est archivé avec lui
statut: terminée
epic: EPIC-003
regles: [R3]
adr: [ADR-0027]
---

# US-013 : Le contenu d'un jeu archivé est archivé avec lui

En tant qu'organisatrice, je veux que le contenu d'un jeu archivé soit traité comme archivé, afin que mes listes ne montrent que le contenu des jeux en cours.

## Critères d'acceptation

- [x] Étant donné un jeu archivé, quand j'ouvre la liste des personnages, factions, intrigues, objets, documents ou lieux, alors son contenu n'y figure pas.
- [x] Chaque liste a une case « Afficher les archives » (sans jeu actif) : cochée, elle montre aussi le contenu des jeux archivés, avec le badge « Archivé ».
- [x] La chronologie montre un seul jeu à la fois, choisi explicitement : ses raccourcis ne proposent que des jeux en cours, la recherche trouve aussi les jeux archivés, marqués « (archivé) », et un jeu archivé choisi porte le badge « Jeu archivé ».
- [x] Quand le jeu archivé est le jeu actif, ou celui choisi dans le filtre par jeu, son contenu est affiché, avec le badge, sans cocher la case.
- [x] La fiche d'un personnage, d'une faction ou d'une intrigue d'un jeu archivé porte le badge « Archivé ».
- [x] Restaurer le jeu fait revenir son contenu dans les listes, sans badge.
- [x] L'API n'accepte plus `published` pour le contenu (personnages, factions, intrigues, objets, documents, événements, lieux) et ne l'écrit plus.

## Notes techniques

- État lu sur le jeu (`isArchivedGame(item.game)`) : [ADR-0027](../../../adr/ADR-0027-archivage-porte-par-le-jeu.md). Les listes de l'API incluent déjà `game`.
- Filtre côté client, comme la page Jeux, dans des fonctions partagées (`isInArchivedGame`, `isVisibleContent` dans `utils/games.ts`). Un élément créé hors ligne n'a pas encore son jeu en cache : il reste visible.
- Les colonnes `published` du contenu restent en base, inutilisées (ADR-0024).

## Tests

- Unitaires (`tests/utils/games.test.ts`) : `isInArchivedGame` et `isVisibleContent` (jeu archivé masqué, affiché avec la case, affiché quand il est le jeu actif ou filtré, élément créé hors ligne gardé visible).
- Unitaires (`tests/server/contentSchemas.test.ts`) : les sept schémas de contenu ignorent `published`.
