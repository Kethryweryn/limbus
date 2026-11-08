---
id: US-194
titre: Stocker les dates avec leur fuseau horaire
statut: à faire
epic: EPIC-049
regles: []
adr: [ADR-0076]
---

# US-194 : Stocker les dates avec leur fuseau horaire

En tant que mainteneuse de Limbus, je veux que les dates soient stockées avec leur fuseau, afin qu'un instant garde son sens dans le SQL écrit à la main et quel que soit le fuseau du serveur.

## Critères d'acceptation

- [ ] Toutes les colonnes de date sont en `timestamptz(3)`, l'existant lu comme de l'UTC.
- [ ] Avant la migration, une copie de la base de production est convertie et le build en service y lit et écrit les mêmes instants.
- [ ] Un test vérifie que toute colonne de date du schéma déclare `@db.Timestamptz(3)`.

## Notes techniques

Dernier lot de l'epic. Changement de type de toutes les dates : migration marquée incompatible (ADR-0076).

ADR :
- [ADR-0076](../../adr/ADR-0076-dates-avec-fuseau.md)

## Tests

Intégration : le test du schéma ; suites des délais (inscriptions, présences, copies des envois, inactivité).
