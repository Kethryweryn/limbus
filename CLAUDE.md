# Limbus

Outil d'organisation de GN (Nuxt 4, Nuxt UI 4, Prisma 7 / PostgreSQL). Contexte produit et commandes : voir README.md. Le code et l'interface sont en français.

## Documentation (`doc/`)

Toute évolution suit le cycle décrit dans `doc/README.md` : fiche `doc/todo/` → `SPEC-NNN` → epics et `US-NNN` → archive.

- Une nouvelle idée ou demande de fonctionnalité devient d'abord une fiche todo (modèles dans `doc/modeles/`).
- Toute décision technique (modèle de données, algorithme, bibliothèque, sécurité) fait l'objet d'un ADR dans `doc/adr/`. On ne supprime pas un ADR, on le remplace.
- Les commits d'implémentation citent l'US ; l'US et l'index sont mis à jour dans le même commit.
- Avant de travailler sur une fonctionnalité, lire sa spec et les ADR liés. Chaque dossier a un index `README.md` : le tenir à jour.

## Avant de considérer un changement terminé

`npm run lint`, `npm run typecheck` et `npm test` doivent passer. Le build, les tests d'intégration et Playwright tournent dans la CI de la PR (ADR-0023) : inutile de les relancer en local avant d'ouvrir la PR. Sous Windows, le build échoue au prérendu.

On ne pousse jamais directement sur `main` (ADR-0017) : chaque chantier a sa branche (`us/…`, `doc/…`, `fix/…`, `deps/…`) et sa pull request, qui cite ses US, specs et ADR. On fusionne en squash une PR dont la CI est verte ; GitHub l'impose, et exige une branche à jour avec `main` (ADR-0023). La CI de la PR construit l'application dans un conteneur Debian 12 + Node 24 (comme le serveur), la teste et archive ce build ; la seule vérification exigée est « Verdict CI ». La fusion dans `main` ne relance pas la CI : **le build testé est déployé aussitôt en production** (job `deploy`, qui l'envoie à `deploy.sh <sha>` sur le serveur ; lancé à la main, `deploy.sh` reconstruit sur place). Fusionner une PR est donc une mise en production. Une PR qui ne touche que `doc/` ou les `*.md` de la racine passe sa CI sans rien exécuter et ne déploie rien (ADR-0022, ADR-0023). Si aucune archive testée ne correspond à `main` (archive expirée…), lancer le workflow CI à la main sur `main` : il construit, teste et déploie. Une migration ne doit pas casser le build encore en service pendant le déploiement : la CI refuse suppressions, renommages, `SET NOT NULL` et changements de type, sauf commentaire `-- deploiement-incompatible : <raison>` (ADR-0024).

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
- Fichiers téléversés (`server/utils/uploads.ts`) : toute modification ou suppression qui retire une référence à une photo ou à un RIB appelle ensuite `deleteUnusedUploads` (relever les URL avec `collectUploadUrls` avant une suppression). Les participants n'ont pas de compte : un fichier qui leur est destiné part en pièce jointe, jamais en lien vers l'API. Une URL de fichier téléversé reçue dans un corps de requête doit désigner un fichier du même jeu : `assertGameUploads`.
- URL saisies par les utilisateurs : schémas `externalUrl` / `uploadOrExternalUrl` (http(s) ou fichier téléversé uniquement), sinon un `javascript:` s'exécuterait dans un lien ou une iframe. Seul YouTube est intégré en iframe (`youtubeEmbedUrl`). Le serveur ne télécharge une image externe que via `fetchPublicImage` (hôte public, délai et taille bornés).
- Une ressource ne change jamais de jeu (`assertSameGame`).
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
- Hors ligne : la déconnexion efface tout ce qui est sur l'appareil (`clearOfflineData`), et la connexion d'un autre compte aussi (`claimOfflineData`). Seul un 401 renvoie à l'écran de connexion ; un 403 est un refus ponctuel.
- Hors ligne : mode lecture d'abord. Les écritures hors ligne sont mises en file (`utils/offlineSync.ts`), mais la resynchronisation reste un chantier à part. Un POST ou un DELETE sur une sous-route (envoi d'emails, génération, legs, partages…) est une action : jamais mis en file.

## Tests

Intégration (`tests/integration/`) : l'application compilée tourne contre une base PostgreSQL jetable, dont le nom doit contenir « test » car elle est vidée. Le scénario : deux organisatrices, Alice et Bob, et une co-organisatrice ; on vérifie qu'Alice n'atteint rien du jeu de Bob, avec un témoin positif à chaque fois. Lancement : `npm run build && TEST_DATABASE_URL=postgresql://…/limbus_test npm run test:integration`. En local sous Windows, il faut passer par un conteneur Linux.

Bout en bout : Playwright (`tests/e2e/`), dans Chromium, contre l'application compilée et la même base de test : connexion, déconnexion (données de l'appareil effacées), 403, page publique. Lancement : `npm run build && TEST_DATABASE_URL=… npm run test:e2e`. Sous Windows, passer par l'image `mcr.microsoft.com/playwright:v<version>-noble` (même version que `@playwright/test`). Attendre `networkidle` avant de remplir un formulaire : avant l'hydratation, le clic le soumet nativement.

Dépendances : Dependabot ouvre chaque lundi une PR groupée (mineures et correctifs) et une PR par version majeure. La CI les valide ; les fusionner les déploie.

Unitaires : Vitest (`tests/`). `tests/setup.ts` recrée les auto-imports Nitro (`createError`, `getHeader`, `useRuntimeConfig`…) et remplace Prisma par un objet vide. Dans un test, on lui assigne les méthodes nécessaires (voir `tests/server/auth.test.ts`). `h3` est fixé en v1 en devDependency pour correspondre à Nitro.
