---
id: ADR-0073
titre: Les valeurs à liste fermée sont des énumérations, les règles entre colonnes des contraintes CHECK
statut: accepté
date: 2026-11-09
liens: [../archive/todo/schema-de-donnees.md, ../archive/epics/EPIC-049-schema-de-donnees/US-189-enumerations.md, ../archive/epics/EPIC-049-schema-de-donnees/US-190-regles-des-liens-et-des-relations.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0073 : Les valeurs à liste fermée sont des énumérations, les règles entre colonnes des contraintes CHECK

## Contexte

Une trentaine de colonnes `String` n'acceptent que quelques valeurs (statuts, rôles, types, sortes), et seul le code les vérifie : une faute dans une migration ou une requête SQL passe sans erreur ([revue du schéma](../archive/todo/schema-de-donnees.md), § 2). Deux règles portent en plus sur plusieurs colonnes : un lien du questionnaire vise exactement une cible, une relation ne relie pas un personnage à lui-même (§ 3).

## Décision

- **Énumérations.** Chaque colonne à liste fermée devient un `enum` Prisma, donc un type énuméré PostgreSQL ; `Document.audiences` devient une liste de ce type. Le client Prisma les type, et le code reprend ces types au lieu de ses unions de chaînes. Les valeurs gardent leur orthographe actuelle : aucune valeur ne change, même si la conversion réécrit physiquement chaque table concernée.
- **Changer une liste.** Ajouter une valeur (`ALTER TYPE … ADD VALUE`) est compatible avec le build en service. En retirer ou en renommer une demande de recréer le type : migration marquée `-- deploiement-incompatible`, après que plus aucune ligne ni aucun build ne l'utilise.
- **Règles entre colonnes.** Une règle qui ne se réduit pas à une liste de valeurs s'écrit en contrainte `CHECK` à la main dans la migration (`migrate dev --create-only`). Prisma ne la décrit pas dans le schéma et `migrate diff` ne la compare pas, donc ne la retire pas ([documentation de Prisma](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features)) ; chaque contrainte est nommée et citée en commentaire au-dessus du modèle.

## Conséquences

- La base refuse une valeur inconnue, et une faute de frappe dans le code devient une erreur de typage.
- Passer une colonne de `text` à un type énuméré est un changement de type : la migration est marquée incompatible ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). Ce que fait alors le build d'avant se vérifie sur une base migrée, avec son propre client Prisma.
- La migration échoue si une ligne de production porte une valeur hors liste : chaque liste est d'abord confrontée aux valeurs présentes.
- Prisma génère pour ce changement une suppression puis un ajout de colonne, qui efface les valeurs : la migration s'écrit à la main, colonne par colonne (`ALTER COLUMN … TYPE … USING …::text::"Type"`), et les index partiels qui comparent la colonne à du texte sont recréés.
- Un tri sur une colonne énumérée suit l'ordre de déclaration des valeurs, plus l'ordre alphabétique. Les tris existants (personnages PJ puis PNJ, comptes admin puis user) gardent leur ordre, leurs valeurs étant déclarées dans l'ordre alphabétique ; un nouveau tri sur une énumération choisit l'ordre de déclaration en conséquence.
- Une valeur avec tiret n'est pas un nom d'énumération Prisma : elle garde sa valeur en base par `@map`, et le code emploie le nom sans tiret.
- Vérifié à l'implémentation (US-189) : le client Prisma du build d'avant écrit et filtre les colonnes converties, mais ne lit pas une liste d'énumération (`Document.audiences`), que le pilote `pg` lui rend en texte brut.
- Vérifié à l'implémentation (US-190) : `migrate diff` ignore les contraintes `CHECK` et les index uniques partiels écrits à la main, mais retire un index unique complet absent du schéma, même `NULLS NOT DISTINCT`. Une unicité sur des colonnes facultatives s'écrit donc en index partiels.

## Options écartées

- **Contraintes `CHECK` pour les listes** : plus simples à changer, recommandées dans la revue ; écartées par l'utilisatrice au profit du typage de bout en bout.
- **Ne rien changer** : le code resterait seul à garder les valeurs.
