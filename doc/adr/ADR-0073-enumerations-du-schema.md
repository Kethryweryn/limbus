---
id: ADR-0073
titre: Les valeurs à liste fermée sont des énumérations, les règles entre colonnes des contraintes CHECK
statut: proposé
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../epics/EPIC-049-schema-de-donnees/US-189-enumerations.md, ../epics/EPIC-049-schema-de-donnees/US-190-regles-des-liens-et-des-relations.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0073 : Les valeurs à liste fermée sont des énumérations, les règles entre colonnes des contraintes CHECK

## Contexte

Une trentaine de colonnes `String` n'acceptent que quelques valeurs (statuts, rôles, types, sortes), et seul le code les vérifie : une faute dans une migration ou une requête SQL passe sans erreur ([revue du schéma](../archive/todo/schema-de-donnees.md), § 2). Deux règles portent en plus sur plusieurs colonnes : un lien du questionnaire vise exactement une cible, une relation ne relie pas un personnage à lui-même (§ 3).

## Décision

- **Énumérations.** Chaque colonne à liste fermée devient un `enum` Prisma, donc un type énuméré PostgreSQL ; `Document.audiences` devient une liste de ce type. Le client Prisma les type, et le code reprend ces types au lieu de ses unions de chaînes. Les valeurs gardent leur orthographe actuelle : aucune donnée n'est réécrite.
- **Changer une liste.** Ajouter une valeur (`ALTER TYPE … ADD VALUE`) est compatible avec le build en service. En retirer ou en renommer une demande de recréer le type : migration marquée `-- deploiement-incompatible`, après que plus aucune ligne ni aucun build ne l'utilise.
- **Règles entre colonnes.** Une règle qui ne se réduit pas à une liste de valeurs s'écrit en contrainte `CHECK` à la main dans la migration (`migrate dev --create-only`). Prisma ne la décrit pas dans le schéma et `migrate diff` ne la compare pas, donc ne la retire pas ([documentation de Prisma](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features)) ; chaque contrainte est nommée et citée en commentaire au-dessus du modèle.

## Conséquences

- La base refuse une valeur inconnue, et une faute de frappe dans le code devient une erreur de typage.
- Passer une colonne de `text` à un type énuméré est un changement de type : la migration est marquée incompatible ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). Il reste à vérifier sur une copie que le build d'avant écrit encore dans la colonne convertie ; sinon, l'écart dure le temps du déploiement.
- La migration échoue si une ligne de production porte une valeur hors liste : chaque liste est d'abord confrontée aux valeurs présentes.

## Options écartées

- **Contraintes `CHECK` pour les listes** : plus simples à changer, recommandées dans la revue ; écartées par l'utilisatrice au profit du typage de bout en bout.
- **Ne rien changer** : le code resterait seul à garder les valeurs.
