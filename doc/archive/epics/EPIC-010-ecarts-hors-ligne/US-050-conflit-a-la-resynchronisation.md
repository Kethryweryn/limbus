---
id: US-050
titre: Contrôler et résoudre les conflits à la resynchronisation
statut: terminée
epic: EPIC-010
regles: [R8, R12]
adr: [ADR-0036, ADR-0028]
---

# US-050 : Contrôler et résoudre les conflits à la resynchronisation

En tant qu'organisatrice, je veux qu'une modification faite hors ligne n'écrase jamais sans me le dire celle d'une co-organisatrice, et choisir quelle version garder.

## Critères d'acceptation

- [x] Toute écriture rejouée porte la version lue de l'élément, suppressions et sous-routes comprises ; le serveur la refuse (409) si l'élément a changé depuis.
- [x] Deux modifications hors ligne du même élément passent l'une après l'autre : la seconde reprend la version laissée par la première.
- [x] Face à un conflit, le panneau montre côte à côte les seuls champs qui diffèrent entre ma version et celle du serveur.
- [x] « Garder ma version » renvoie ma modification, qui remplace celle du serveur ; « Garder celle du serveur » abandonne ma modification. Une suppression en conflit se confirme ou s'abandonne de même.

## Notes techniques

- Versions par route : voir [ADR-0036](../../../adr/ADR-0036-protocole-de-resynchronisation.md).
- Nouvelle colonne `Session.paymentSettingsUpdatedAt` (migration sans risque pour le build en service).

## Tests

- Unitaires : version des suppressions ; chaînage des versions ; champs qui diffèrent.
- Intégration : suppression refusée après une modification ; paiement, réglages, tarif et trombinoscope refusés sur une version périmée.
