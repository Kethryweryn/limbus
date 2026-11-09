---
id: EPIC-049
titre: Schéma de données
statut: terminé
spec: ../../todo/schema-de-donnees.md
date: 2026-11-09
---

# EPIC-049 : Schéma de données

## Objectif

Corriger les écarts du schéma de données avec les pratiques reconnues de PostgreSQL et de Prisma, relevés par la [revue du schéma](../../todo/schema-de-donnees.md) : index des clés étrangères, valeurs et règles tenues par la base, liens entre jeux refusés, emails sans casse, colonnes inutiles retirées, dates avec fuseau. Rien ne change pour les personnes qui utilisent Limbus : pas de note dans `nouveautes/`.

## US

| US | Titre | Statut |
|---|---|---|
| [US-188](US-188-index-et-homogeneite.md) | Indexer les clés étrangères et rendre le schéma homogène | terminée |
| [US-189](US-189-enumerations.md) | Faire refuser par la base les valeurs inconnues | terminée |
| [US-190](US-190-regles-des-liens-et-des-relations.md) | Faire tenir par la base les règles des liens du questionnaire et des relations | terminée |
| [US-191](US-191-meme-jeu-impose-par-la-base.md) | Faire refuser par la base un lien entre éléments du contenu de deux jeux | terminée |
| [US-192](US-192-emails-sans-casse.md) | Comparer les adresses email sans tenir compte de la casse dans la base | terminée |
| [US-193](US-193-restes-de-transitions-et-pdf.md) | Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire | terminée |
| [US-194](US-194-dates-avec-fuseau.md) | Stocker les dates avec leur fuseau horaire | terminée |
| [US-195](US-195-meme-jeu-sessions-et-vivier.md) | Faire refuser par la base un lien entre deux jeux dans les sessions et le vivier | terminée |

Ordre : US-188 d'abord, US-194 en dernier ; une PR par US. L'US-195, détachée de l'US-191 trop lourde pour une PR, la suit.

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Chaque migration vérifiée contre les données de production avant la fusion, et marquée incompatible quand elle change un type ou supprime une colonne ([ADR-0024](../../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- Fiche à jour, ADR-0073 à ADR-0077 acceptés ou remplacés.

## Suivi

- 2026-11-09 : déployé en dix PR, chacune vérifiée en production (dernière migration appliquée, sites joignables) : US-188 (#175), US-189 (#176), US-190 (#178), US-191 (#179), US-195 (#180), US-192 (#181), US-193 en deux déploiements (#182, #183), US-194 en deux déploiements (#184, #185).
- Chaque migration a été confrontée aux données de production avant la fusion, et les changements de type joués avec le client Prisma du build en service sur une base migrée.
- Ce que le chantier a changé en route :
  - l'US-195, détachée de l'US-191, trop lourde pour une PR ;
  - [ADR-0077](../../../adr/ADR-0077-references-videes-par-la-base.md), qui remplace en partie l'ADR-0074 : une référence facultative se vide par la base (`ON DELETE SET NULL (colonne)`), pas par le code ;
  - l'US-194 en deux déploiements : la production est réglée sur Europe/Paris, et l'adaptateur pg de Prisma 7 décale les dates `timestamptz` hors d'une session en UTC (prisma/orm#26786) ; les connexions ouvrent donc leur session en UTC ;
  - des dates posées par la base pendant d'anciennes migrations, en heure de Paris, avaient une heure d'avance (66 fiches, 96 lignes de casting, 46 équipes, 6 dates de compte) : corrigées par la conversion.
- Les revues ont notamment ajouté les garde-fous de `tests/integration/sameGame.test.ts` (clé qui ne compare pas le jeu, table de liaison sans jeu, `SET NULL` qui viderait le jeu), un refus explicite des écritures de documents d'avant ADR-0072, et l'effacement des documents gardés sur l'appareil avant cette décision (base hors ligne en version 13).
- Défauts trouvés en chemin : rôles et statuts invalides dans des tests, RIB d'essai de Valombre sans jeu, outil des assistants qui ne voyait pas les documents d'un personnage (note dans `nouveautes/`).
- Limites connues :
  - Prisma affiche un avertissement par référence vidée par la base (neuf) ; une migration générée qui recréerait une de ces clés doit être corrigée à la main, ce que vérifie `sameGame.test.ts` ;
  - toute connexion Prisma doit passer par `pgAdapterOptions`, sans quoi les dates seraient décalées ;
  - la vérification de l'US-194 s'est faite sur une base locale réglée comme la production, pas sur une copie de la production (choix de l'utilisatrice).
- Epic archivé.
