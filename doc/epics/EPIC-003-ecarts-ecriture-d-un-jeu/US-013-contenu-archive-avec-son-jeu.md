---
id: US-013
titre: Le contenu d'un jeu archivé est archivé avec lui
statut: à faire
epic: EPIC-003
regles: [R3]
adr: [ADR-0027]
---

# US-013 : Le contenu d'un jeu archivé est archivé avec lui

En tant qu'organisatrice, je veux que le contenu d'un jeu archivé soit traité comme archivé, afin que mes listes ne montrent que le contenu des jeux en cours.

## Critères d'acceptation

- [ ] Étant donné un jeu archivé, quand j'ouvre la liste des personnages, factions, intrigues, objets, documents, de la chronologie ou des lieux, alors son contenu n'y figure pas.
- [ ] Chaque liste a une case « Afficher les archives » : cochée, elle montre aussi le contenu des jeux archivés, avec le badge « Archivé ».
- [ ] Quand le jeu archivé est le jeu actif, ou celui choisi dans le filtre par jeu, son contenu est affiché, avec le badge, sans cocher la case.
- [ ] La fiche d'un personnage, d'une faction ou d'une intrigue d'un jeu archivé porte le badge « Archivé ».
- [ ] Restaurer le jeu fait revenir son contenu dans les listes, sans badge.
- [ ] L'API n'accepte plus `published` pour le contenu (personnages, factions, intrigues, objets, documents, événements, lieux) et ne l'écrit plus.

## Notes techniques

- État lu sur le jeu (`isArchivedGame(item.game)`) : [ADR-0027](../../adr/ADR-0027-archivage-porte-par-le-jeu.md). Les listes de l'API incluent déjà `game`.
- Filtre côté client, comme la page Jeux, dans une fonction partagée (`utils/games.ts`).
- Les colonnes `published` du contenu restent en base, inutilisées (ADR-0024).

## Tests

- Unitaires : la fonction de filtre (jeu archivé masqué, affiché avec la case, affiché quand il est le jeu actif ou filtré).
- Unitaires : les schémas de contenu ignorent `published`.
