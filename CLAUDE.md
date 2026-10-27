# Limbus

Outil d'organisation de GN (Nuxt 4, Nuxt UI 4, Prisma 7 / PostgreSQL). Contexte produit et commandes : voir README.md. Le code et l'interface sont en français.

## Avant de considérer un changement terminé

`npm run lint`, `npm run typecheck` et `npm test` doivent passer. Le build et les tests d'intégration tournent dans la CI (GitHub Actions) ; sous Windows, le build échoue au prérendu.

On travaille directement sur `main`. Chaque push déclenche la CI, et **si elle passe, le commit est déployé automatiquement en production** (job `deploy`, qui lance `deploy.sh <sha>` sur le serveur). Un push sur main est donc une mise en production.

## Sécurité des routes API

- Toute route sous `server/api` commence par `requireOrganizer(event)` (ou `requireAdmin`), sauf les routes volontairement publiques : `auth/*`, `invitations/[token]` et `public/*`.
- Toute donnée rattachée à un jeu est filtrée par accès au jeu :
  - `requireGameAccess(event, gameId)` pour une ressource précise ;
  - `requireSessionAccess(event, id)` pour une session ;
  - `gameScopedWhere` / `accessibleGameIds` pour les listes.
- Quand une modification change le `gameId` d'une ressource, vérifier l'accès au jeu cible aussi. Les références vers d'autres entités (factions, lieu, participants, personnages) doivent appartenir au même jeu.
- Corps de requête : toujours valider avec un schéma zod de `server/utils/schemas.ts` via `readZodBody`.
- Le JWT ne porte que l'`id` et la version de session `v` : rôle et email sont relus en base à chaque requête, et un jeton dont `v` ne correspond plus à `User.sessionVersion` est refusé. Pour déconnecter un compte partout (changement de mot de passe…), appeler `revokeUserSessions`.
- Données personnelles des participants : la suppression passe par `eraseParticipant` (photos et fichiers compris), l'export par `exportParticipantData`, limité aux jeux de l'organisateur. Toute nouvelle donnée liée à un participant doit être couverte par ces deux fonctions (`server/utils/participantPrivacy.ts`).
- Les fichiers uploadés sont servis par des routes qui vérifient les droits, jamais en statique. On vérifie le type réel (signature) et on renomme avec un UUID.
- Les liens absolus (emails, PDF) passent par `absoluteAppUrl()`, jamais par les en-têtes Host.
- L'IP client pour le rate limit est la dernière entrée de `X-Forwarded-For`, ajoutée par Apache (voir `clientIp`).
- Jamais de `process.env.X` dans `nuxt.config.ts` pour un secret : la valeur serait figée en clair dans `.output` au build. `runtimeConfig` reste vide, et le code lit `useRuntimeConfig().x || process.env.X` à l'exécution.
- Toute nouvelle route ou ressource liée à un jeu doit être ajoutée à `tests/integration/isolation.test.ts`.

## Conventions API

- Les pages utilisent des slugs (`/games/:slug`, `/characters/:slug`). L'API qui modifie ou relie des données utilise les identifiants stables (`PUT /api/games/:id`), car un slug change avec le titre.
- Les lectures par slug sont explicites : `GET /api/games/slug/:slug`.
- Fichiers d'API : suffixes Nitro `.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`.
- Écritures concurrentes : `assertUnmodifiedSince` (`server/utils/concurrency.ts`).

## Conventions UI

- Nuxt UI v4 : le contenu d'un `UModal` va dans le slot `#body`, sinon il s'affiche dans la page.
- Chaque page doit avoir un seul élément racine dans son template.
- Hors ligne : mode lecture d'abord. Les écritures hors ligne sont mises en file (`utils/offlineSync.ts`), mais la resynchronisation reste un chantier à part.

## Tests

Intégration (`tests/integration/`) : l'application compilée tourne contre une base PostgreSQL jetable, dont le nom doit contenir « test » car elle est vidée. Le scénario : deux organisatrices, Alice et Bob, et une co-organisatrice ; on vérifie qu'Alice n'atteint rien du jeu de Bob, avec un témoin positif à chaque fois. Lancement : `npm run build && TEST_DATABASE_URL=postgresql://…/limbus_test npm run test:integration`. En local sous Windows, il faut passer par un conteneur Linux.

Unitaires : Vitest (`tests/`). `tests/setup.ts` recrée les auto-imports Nitro (`createError`, `getHeader`, `useRuntimeConfig`…) et remplace Prisma par un objet vide. Dans un test, on lui assigne les méthodes nécessaires (voir `tests/server/auth.test.ts`). `h3` est fixé en v1 en devDependency pour correspondre à Nitro.
