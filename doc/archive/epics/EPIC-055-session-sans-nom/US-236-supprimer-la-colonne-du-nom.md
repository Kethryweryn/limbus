---
id: US-236
titre: Supprimer la colonne du nom des sessions
statut: terminée
epic: EPIC-055
regles: [R6]
adr: [ADR-0084, ADR-0024]
---

# US-236 : Supprimer la colonne du nom des sessions

En tant que mainteneur, je veux supprimer la colonne `Session.name`, devenue inutile, afin qu'aucun code ne puisse plus s'appuyer sur un nom de session.

## Critères d'acceptation

- [x] Étant donné le build d'US-234 en service, quand la migration passe, alors la colonne `name` de `Session` n'existe plus, et le schéma Prisma ne la mentionne plus.
- [x] Étant donné la CI, alors la migration porte le commentaire `-- deploiement-incompatible : <raison>` (ADR-0024).

## Notes techniques

- Migration `20261127090000_session_sans_colonne_nom` (`DROP COLUMN`, commentaire `deploiement-incompatible`) après le déploiement d'US-234 (PR #217) : le build en service ne lit plus la colonne.

## Tests

- Actions, erreurs de saisie, droits, hors ligne : aucun changement visible, rien à écrire ; les suites d'intégration (jeux de test compris) et les écrans de session passent sur la base migrée.
