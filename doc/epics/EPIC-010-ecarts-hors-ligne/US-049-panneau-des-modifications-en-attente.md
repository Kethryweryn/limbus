---
id: US-049
titre: Le panneau des modifications en attente
statut: à faire
epic: EPIC-010
regles: [R7, R9]
adr: [ADR-0036]
---

# US-049 : Le panneau des modifications en attente

En tant qu'organisatrice, je veux voir les modifications faites hors ligne qui attendent ou ont échoué, et en abandonner sans me déconnecter.

## Critères d'acceptation

- [ ] Le bandeau indique « 3 en attente, 1 erreur » et ouvre un panneau qui liste chaque modification : l'élément, l'action, la date et, en cas d'échec, la cause du refus.
- [ ] Une modification s'abandonne, ou toute la file, sans se déconnecter ; abandonner la création d'un élément abandonne aussi les modifications suivantes de cet élément.
- [ ] Une modification en échec qui n'est pas un conflit peut être renvoyée.
- [ ] Une modification en erreur retient les suivantes du même élément jusqu'à sa résolution ; celles des autres éléments partent.

## Notes techniques

- Élément d'une modification : ressource et identifiant (`sessions/<id>`), sous-routes comprises ([ADR-0036](../../adr/ADR-0036-protocole-de-resynchronisation.md)).

## Tests

- Unitaires : retenue par élément ; abandon en cascade d'une création ; libellés des modifications.
