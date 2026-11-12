---
id: US-242
titre: Retirer le nom et le téléphone de la fiche
statut: en cours
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

Choix de l'utilisatrice, le 2026-11-12 : retirer les colonnes, même si le chantier touche une soixantaine de fichiers, pour qu'aucune lecture ne puisse retomber sur le nom d'une autre équipe.

Plan, en deux PR (ADR-0024) :

1. **Le code ne lit ni n'écrit plus `Participant.name` et `Participant.phone`.** La migration les rend facultatives (`DROP NOT NULL`), et le schéma les garde en `String?`, que rien n'utilise.
   - `withGameValues` ajoute le nom et le téléphone du jeu à chaque fiche d'une lecture (`participant`, `targetParticipant`, `transferredTo`), sans repli sur la fiche, avec un type qui les porte.
   - Les sélections ne demandent plus que l'identifiant.
   - Les écritures ne passent plus que par les liens.
   - Liste et fiche : `latestVisibleValues`.
   - Jeux de test et tests : nom et téléphone sur les liens.
   - Les usages se repèrent en retirant les deux champs du schéma en local : le typage liste chaque lecture.
2. **Suppression des colonnes** (`DROP COLUMN`, commentaire `deploiement-incompatible`), après le déploiement de l'étape 1. Le nom par jeu devient obligatoire (`SET NOT NULL`, après remplissage).

## Avancement

- **Étape 1** : le code ne lit ni n'écrit plus les colonnes de la fiche ; migration `20261205090000_nom_de_fiche_facultatif` (`DROP NOT NULL` sur `name`, `phone` l'était déjà). `withGameValues` porte le nom et le téléphone dans son type (`GameNamed`) et ne retombe plus sur la fiche : un lien sans nom donne un nom vide. Les tests créent leurs fiches avec le nom et le téléphone sur leurs liens (`tests/fiche.ts`).
- **Étape 2** : à faire après le déploiement de l'étape 1.

## Tests

- Actions, erreurs de saisie, droits, hors ligne : aucun changement visible ; les suites d'intégration et les écrans de participants passent sur la base migrée.
