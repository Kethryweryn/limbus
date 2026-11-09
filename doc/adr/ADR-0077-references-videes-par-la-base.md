---
id: ADR-0077
titre: Une référence composée avec le jeu se vide par la base, sans toucher au jeu
statut: accepté
date: 2026-11-09
liens: [ADR-0074-meme-jeu-impose-par-la-base.md, ../epics/EPIC-049-schema-de-donnees/US-195-meme-jeu-sessions-et-vivier.md, ../epics/EPIC-049-schema-de-donnees/US-191-meme-jeu-impose-par-la-base.md]
---

# ADR-0077 : Une référence composée avec le jeu se vide par la base, sans toucher au jeu

## Contexte

Avec [ADR-0074](ADR-0074-meme-jeu-impose-par-la-base.md), une référence facultative qui se vidait à la suppression de sa cible (`onDelete: SetNull`) porte aussi le `gameId`. Un `ON DELETE SET NULL` sur toute la clé viderait aussi `gameId`, qui est obligatoire : la suppression échouerait. L'ADR-0074 prévoyait donc `onDelete: NoAction`, le code vidant la référence avant chaque suppression.

Les références concernées sont dix : l'objet porté par un personnage, l'ancien personnage d'un document, le lieu et la session de report d'une session, la session d'un tirage et d'une invitation, la version du formulaire d'une inscription et d'une demande, la place réservée d'un personnage, le report d'un paiement. Plusieurs suppressions arrivent en cascade : effacer une personne supprime ses inscriptions, et donc les places qui leur étaient réservées. Le code devrait vider ces références sur chaque chemin, et un chemin oublié fait échouer la suppression.

PostgreSQL 15, celui du serveur, sait n'effacer que certaines colonnes de la clé : `ON DELETE SET NULL (colonne)` ([documentation de PostgreSQL](https://www.postgresql.org/docs/15/sql-createtable.html)).

## Décision

- Une référence facultative composée avec le jeu, qui doit se vider à la suppression de sa cible, est déclarée `onDelete: SetNull` dans le schéma Prisma. Sa clé étrangère est écrite à la main dans la migration avec `ON DELETE SET NULL ("colonne")` : la base n'efface que l'identifiant et garde le jeu.
- Le code ne vide plus ces références avant une suppression.
- Les deux références de l'US-191 (`Item.locationCharacterId`, `Document.characterId`) passent au même régime.

## Conséquences

- Aucun chemin de suppression, cascades comprises, ne peut oublier une référence.
- Vérifié à l'implémentation (US-195) : `migrate diff` ne compare pas la liste des colonnes d'un `SET NULL`, et ne retire donc pas ces clés. Le PostgreSQL du serveur (15.19) l'accepte.
- Prisma affiche un avertissement à chaque commande, un par référence (« `SetNull` … when a referenced field is required ») : il est attendu.
- Une migration générée qui recrée une de ces clés écrirait `ON DELETE SET NULL` sans liste de colonnes : elle doit être corrigée à la main. `tests/integration/sameGame.test.ts` vérifie que chacune n'efface que son identifiant.

## Options écartées

- **Le code vide les références (ADR-0074)** : chaque suppression, cascades comprises (effacement d'une personne, d'un compte, d'un vivier…), doit y penser ; un oubli fait échouer la suppression. Écartée par l'utilisatrice.
- **Déclencheurs** : écartés par ADR-0074, invisibles dans le schéma.
