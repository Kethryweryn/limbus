---
id: ADR-0009
titre: Suppression en cascade du contenu d'un jeu par la base
statut: accepté
date: 2026-10-27
liens: [ADR-0008]
---

# ADR-0009 : Suppression en cascade du contenu d'un jeu par la base

*Rédigé a posteriori, pour la migration `20261027170000_cascade_game_deletion`.*

## Contexte

La suppression d'un jeu, d'une session ou d'un personnage supprimait les dépendances à la main dans le code de la route, dans un ordre précis. Un oubli faisait échouer la suppression sur une contrainte de clé étrangère, ou laissait des données orphelines.

## Décision

- Les clés étrangères portent `ON DELETE CASCADE` (et `onDelete: Cascade` dans `schema.prisma`) :
  - `gameId` de `Character`, `Faction`, `Intrigue`, `Item`, `Document`, `Location`, `Session` ;
  - `sessionId` et `characterId` de `SessionAssignment`.
- Les tables de session (paiements, envois, trombinoscopes, responsables de chronologie, participants de session) suivent déjà la session en cascade.
- Les références facultatives vers une entité supprimable (lieu d'un objet, personnage principal d'un document) passent à `NULL` (`SetNull`).
- Les fichiers ne sont pas gérés par la base : la route relève leurs URL avant de supprimer, puis nettoie ([ADR-0008](ADR-0008-fichiers-televerses.md)).

## Conséquences

- La suppression est atomique et complète, quel que soit le nombre de tables liées.
- Une suppression de jeu efface tout son contenu d'un coup : l'interface doit demander une confirmation claire.
- Toute nouvelle table rattachée à un jeu ou une session doit choisir explicitement son comportement (`Cascade` ou `SetNull`).

## Options écartées

- **Suppression logique (`deletedAt`)** : chaque requête devrait filtrer les éléments supprimés, et l'effacement RGPD demande une vraie suppression.
- **Suppression manuelle dans le code** : la situation de départ, fragile.
