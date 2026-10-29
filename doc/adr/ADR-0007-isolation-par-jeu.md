---
id: ADR-0007
titre: Isolation des données par jeu, vérifiée par des tests d'intégration
statut: accepté
date: 2026-10-27
liens: [ADR-0006, ADR-0015]
---

# ADR-0007 : Isolation des données par jeu, vérifiée par des tests d'intégration

*Rédigé a posteriori, pour des règles consolidées le 2026-10-27.*

## Contexte

Plusieurs organisatrices utilisent la même instance. Chacune ne doit voir que ses jeux et ceux qui lui ont été partagés (`GameShare`). Sans règle commune, chaque route vérifiait (ou oubliait de vérifier) les droits à sa façon.

## Décision

- Toute route sous `server/api` commence par `requireOrganizer` (`requireUser` depuis [ADR-0038](ADR-0038-un-seul-role-global.md)) (ou `requireAdmin`), sauf les routes volontairement publiques : `auth/*`, `invitations/[token]` et `public/*`.
- Une ressource précise est contrôlée par `requireGameAccess(event, gameId)` ou `requireSessionAccess(event, id)` ; une liste est filtrée par `gameScopedWhere` / `accessibleGameIds`.
- Une ressource ne change jamais de jeu : `assertSameGame` renvoie 400 si une modification demande un autre `gameId`. Les références vers d'autres entités (factions, lieu, participants, personnages) doivent appartenir au même jeu.
- Les corps de requête sont validés par un schéma zod de `server/utils/schemas.ts`, via `readZodBody`.
- `tests/integration/isolation.test.ts` vérifie, route par route, qu'Alice n'atteint rien du jeu de Bob, avec un témoin positif à chaque fois. Toute nouvelle route liée à un jeu y est ajoutée.

## Conséquences

- La règle est vérifiable à la relecture (première ligne de chaque route) et par les tests.
- Déplacer un contenu d'un jeu à un autre n'est pas possible : il faudra une fonction de copie dédiée (voir la fiche `todo/copie-de-jeu.md`).
- Le test d'isolation grossit avec chaque route ; c'est le prix de la garantie.

## Options écartées

- **Row-Level Security PostgreSQL** : garantie plus forte, mais l'application se connecte avec un seul rôle et l'adaptateur Prisma ne transmet pas l'utilisateur courant ; complexité disproportionnée.
- **Une base par organisatrice** : rend impossible le partage de jeux.
