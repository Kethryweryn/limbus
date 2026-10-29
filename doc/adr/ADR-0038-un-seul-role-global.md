---
id: ADR-0038
titre: Un seul rôle global ; les droits viennent des jeux
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0007-isolation-par-jeu.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0038 : Un seul rôle global ; les droits viennent des jeux

## Contexte

Un compte a un rôle global, « organisateur » ou « administrateur », et toutes les routes commencent par `requireOrganizer`. Avec un compte pour tout le monde ([SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md)), on organise un jeu et on participe à un autre : « organisateur » n'a plus de sens comme rôle global.

## Décision

- `User.role` vaut `admin` ou `user`. Les droits sur un jeu viennent de sa propriété (`Game.ownerId`) ou de son partage (`GameShare`), vérifiés comme aujourd'hui ([ADR-0007](ADR-0007-isolation-par-jeu.md)).
- `requireUser` remplace `requireOrganizer` : un compte connecté, quel que soit son rôle. Les lots suivants y ajoutent l'adresse confirmée.
- La valeur `organizer` des comptes existants reste acceptée : la convertir en `user` dans la même mise en production ferait refuser ces comptes par le build encore en service ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)). La conversion des données vient avec le lot 2, quand le build en service accepte déjà tout rôle.
- Un transfert de jeu en attente est une colonne du jeu (`Game.transferToUserId`) : une seule proposition à la fois, vers une co-organisatrice. L'acceptation échange propriété et partage dans une transaction.

## Conséquences

- La règle de CLAUDE.md sur les routes de l'API cite `requireUser`.
- Une personne qui ne fait que participer aura un compte qui passe `requireUser` : l'accès à chaque jeu reste ce qui la protège, et l'espace « Je participe » (lot 4) n'utilisera que des routes qui vérifient sa fiche.

## Options écartées

- **Des rôles par jeu dans une table** (propriétaire, co-organisatrice, participant) : la propriété et le partage existent déjà ; le rôle de participant viendra de la fiche rattachée au compte.
- **Une table des transferts** : une seule proposition à la fois suffit.
