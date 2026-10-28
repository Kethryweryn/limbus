---
id: ADR-0025
titre: Legs d'un jeu par copie en une transaction, copie en attente sans propriétaire
statut: proposé
date: 2026-10-28
liens: [SPEC-002, EPIC-002, ADR-0007, ADR-0008, ADR-0020]
---

# ADR-0025 : Legs d'un jeu par copie en une transaction, copie en attente sans propriétaire

## Contexte

SPEC-002 prévoit de copier le contenu d'écriture d'un jeu pour le donner à une autre organisatrice. Il faut décider :

- comment copier une vingtaine de tables reliées entre elles sans laisser de copie à moitié faite ;
- comment donner un accès à la copie, et à elle seule, aux photos de trombinoscope ;
- où garder une copie dont la destinataire n'a pas encore de compte (R8), sans qu'elle soit visible et sans tâche planifiée ([ADR-0020](ADR-0020-echeances-evaluees-a-la-lecture.md)) ;
- où stocker le crédit, qui doit survivre au jeu source et à son autrice (R12).

Les fichiers téléversés sont servis selon le jeu de leur ligne `UploadedFile` ([ADR-0008](ADR-0008-fichiers-televerses.md)). Une copie qui pointerait vers les photos du jeu source les rendrait inaccessibles à la destinataire, et leur suppression dépendrait des deux jeux.

## Décision

**Copie.**

- Un service `copyGame(sourceGameId, options)` copie le jeu dans une seule transaction Prisma.
- Il crée les éléments table par table, en tenant une table de correspondance entre anciens et nouveaux identifiants. Les liens (factions, intrigues, objets, documents, chronologie, trombinoscope, références du formulaire) sont recréés à partir de cette table, jamais vers un identifiant du jeu source.
- Les slugs sont régénérés avec `generateUniqueSlug`.
- Le formulaire d'inscription est copié dans sa version en vigueur, qui devient la version 1 (R14).
- Une liste explicite des champs copiés par modèle sert de garde-fou : un test échoue quand un modèle de contenu gagne un champ absent de la liste, pour qu'on décide de le copier ou non.

**Fichiers.**

- Avant la transaction, chaque fichier téléversé référencé par le contenu est dupliqué sur le disque sous un nouvel UUID.
- La ligne `UploadedFile` correspondante est créée dans la transaction, rattachée au jeu copié.
- Si la transaction échoue, les fichiers dupliqués sont effacés.
- Aujourd'hui, seules les photos de trombinoscope des personnages sont concernées. Les liens externes sont repris tels quels.

**Crédit et origine.**

- `Game` gagne `creditSourceTitle` et `creditAuthorName`, figés au moment du legs (R11, R12).
- `Game.copiedFromGameId` (`onDelete: SetNull`) garde le lien interne vers le jeu source, pour lister ses legs en attente. Il ne donne aucun droit.

**Copie en attente (R8).**

- La copie est créée sans propriétaire (`ownerId` nul), avec `Game.bequestPending = true`.
- Elle est exclue de toutes les listes et de tous les contrôles d'accès : `accessibleGameWhere` l'écarte, y compris en mode administrateur.
- L'invitation existante (`GameInvitation`) porte la copie : un nouveau champ `kind` vaut `share` (co-organisation, comportement actuel) ou `bequest` (legs).
- À l'acceptation d'une invitation `bequest`, dans la même transaction :
  - la copie reçoit son propriétaire ;
  - `bequestPending` repasse à faux ;
  - aucun `GameShare` n'est créé.
- **Expiration**, évaluée à la lecture : une copie en attente dont l'invitation a expiré est supprimée, fichiers compris. Cela se fait quand la page des legs du jeu source est lue, quand un nouveau legs est créé, et quand quelqu'un tente d'accepter l'invitation expirée.
- **Annulation** par la propriétaire du jeu source : elle révoque l'invitation et supprime la copie de la même façon.

## Conséquences

- Pas de nouvelle table : trois champs et un booléen sur `Game`, un champ sur `GameInvitation`. Les migrations sont additives ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- `accessibleGameWhere` devient le seul point qui cache les copies en attente. Les tests d'isolation doivent vérifier qu'une copie en attente n'est visible ni par la propriétaire du jeu source, ni par la destinataire avant acceptation, ni en mode administrateur.
- Une très grosse copie tient dans une transaction : acceptable pour la taille des jeux actuels (quelques centaines d'éléments). Au-delà, il faudra découper.
- Une copie en attente abandonnée occupe de la place jusqu'à la prochaine lecture qui la nettoie. C'est acceptable, car elle ne contient aucune donnée personnelle de participant.

## Options écartées

- **Copier au moment de l'acceptation** : la destinataire recevrait l'état du jeu à une date que la propriétaire ne maîtrise pas, et une suppression du jeu source entre-temps ferait échouer le legs. Contraire à R9.
- **Table `GameBequest` à part** : elle doublonnerait l'invitation (email, jeton, expiration, statut). Le champ `kind` suffit.
- **Partager les fichiers entre les deux jeux** : l'accès dépend du jeu de la ligne `UploadedFile`, et la suppression d'un côté toucherait l'autre.
- **Tâche planifiée de nettoyage** : écartée par ADR-0020 ; la lecture suffit.
- **Export puis import (fichier JSON)** : plus lourd pour l'utilisatrice, et l'import devrait revalider tout le contenu. Pourra venir plus tard pour une copie entre instances.
