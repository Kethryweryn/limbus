---
id: US-242
titre: Retirer le nom et le téléphone de la fiche
statut: à faire
epic: EPIC-056
regles: [R6]
adr: [ADR-0086]
---

# US-242 : Retirer le nom et le téléphone de la fiche

En tant que mainteneur, je veux retirer les colonnes `name` et `phone` de `Participant`, remplacées par celles de chaque jeu, afin qu'aucun code ne lise une valeur commune à toutes les équipes.

## Critères d'acceptation

- [ ] Étant donné le build d'[US-237](US-237-valeurs-par-jeu.md) en service, quand la migration passe, alors les colonnes n'existent plus et le schéma Prisma ne les mentionne plus.
- [ ] La migration porte le commentaire `-- deploiement-incompatible : <raison>` (ADR-0024).

## Notes techniques

Migration `DROP COLUMN` après le déploiement d'US-237 et le dernier code qui écrit ces colonnes.

## Tests

- Actions, erreurs de saisie, droits, hors ligne : aucun changement visible ; les suites d'intégration et les écrans de participants passent sur la base migrée.
