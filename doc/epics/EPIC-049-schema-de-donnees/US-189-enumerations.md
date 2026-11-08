---
id: US-189
titre: Faire refuser par la base les valeurs inconnues
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0073]
---

# US-189 : Faire refuser par la base les valeurs inconnues

En tant que mainteneuse de Limbus, je veux que la base refuse une valeur hors liste (un statut, un rôle, une sorte inconnue), afin qu'une faute dans une migration ou une requête ne passe plus en silence.

## Critères d'acceptation

- [ ] Chaque colonne à liste fermée (§ 2 de la fiche) est un `enum` Prisma, `Document.audiences` une liste de ce type ; les valeurs gardent leur orthographe.
- [ ] Avant la migration, les valeurs présentes en production sont confrontées aux listes ; aucune ligne n'est hors liste.
- [ ] Le code reprend les types générés par Prisma au lieu de ses unions de chaînes, là où elles doublaient une liste.
- [ ] Une écriture d'une valeur inconnue est refusée par la base.

## Notes techniques

Changement de type : migration marquée `-- deploiement-incompatible`, après vérification sur une copie de ce que fait le build d'avant (ADR-0073). Relever d'abord la liste exacte des colonnes et de leurs valeurs dans le code et la base.

ADR :
- [ADR-0073](../../adr/ADR-0073-enumerations-du-schema.md)

## Tests

Intégration : une écriture hors liste refusée pour quelques colonnes ; suites existantes (le typage couvre le reste).
