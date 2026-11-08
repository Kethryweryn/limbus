---
id: EPIC-049
titre: Schéma de données
statut: en cours
spec: ../../archive/todo/schema-de-donnees.md
date: 2026-11-09
---

# EPIC-049 : Schéma de données

## Objectif

Corriger les écarts du schéma de données avec les pratiques reconnues de PostgreSQL et de Prisma, relevés par la [revue du schéma](../../archive/todo/schema-de-donnees.md) : index des clés étrangères, valeurs et règles tenues par la base, liens entre jeux refusés, emails sans casse, colonnes inutiles retirées, dates avec fuseau. Rien ne change pour les personnes qui utilisent Limbus : pas de note dans `nouveautes/`.

## US

| US | Titre | Statut |
|---|---|---|
| [US-188](US-188-index-et-homogeneite.md) | Indexer les clés étrangères et rendre le schéma homogène | terminée |
| [US-189](US-189-enumerations.md) | Faire refuser par la base les valeurs inconnues | à faire |
| [US-190](US-190-regles-des-liens-et-des-relations.md) | Faire tenir par la base les règles des liens du questionnaire et des relations | à faire |
| [US-191](US-191-meme-jeu-impose-par-la-base.md) | Faire refuser par la base un lien entre deux jeux | à faire |
| [US-192](US-192-emails-sans-casse.md) | Comparer les adresses email sans tenir compte de la casse dans la base | à faire |
| [US-193](US-193-restes-de-transitions-et-pdf.md) | Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire | à faire |
| [US-194](US-194-dates-avec-fuseau.md) | Stocker les dates avec leur fuseau horaire | à faire |

Ordre : US-188 d'abord, US-194 en dernier ; une PR par US.

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Chaque migration vérifiée contre les données de production avant la fusion, et marquée incompatible quand elle change un type ou supprime une colonne ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- Fiche à jour, ADR-0073 à ADR-0076 acceptés ou remplacés.
