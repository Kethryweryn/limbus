---
paths:
  - "server/**"
  - "pages/**"
  - "composables/**"
---

# Conventions API

- Les pages utilisent des slugs (`/games/:slug`, `/characters/:slug`). L'API qui modifie ou relie des données utilise les identifiants stables (`PUT /api/games/:id`), car un slug change avec le titre.
- Les lectures par slug sont explicites : `GET /api/games/slug/:slug` ; une route `[id]` n'accepte jamais un slug (`server/utils/sheetReads.ts` lit une fiche par l'un ou l'autre). Une page de fiche lit par son slug, puis appelle l'API par l'identifiant de ce qu'elle a lu.
- Fichiers d'API : suffixes Nitro `.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`.
- Liens entre éléments d'un jeu (ADR-0074) : la clé étrangère compare aussi le jeu, `fields: [xId, gameId], references: [id, gameId]`, avec `onUpdate: NoAction`. Une table de liaison est un modèle explicite qui porte le jeu : elle s'écrit par `linkCreate` ou `linkSet` et se lit par `unlinked` (`server/utils/contentLinks.ts`). Une référence facultative qui doit se vider à la suppression de l'élément visé (autrefois `SetNull`) est en `onDelete: NoAction`, et cette suppression la vide d'abord ; une ligne qui doit disparaître avec l'élément garde `Cascade`. `tests/integration/sameGame.test.ts` refuse une clé qui ne compare pas le jeu.
- Écritures concurrentes : `assertUnmodifiedSince` (`server/utils/concurrency.ts`) ; `assertRowsVersion` pour une liste remplacée d'un bloc, dont la version est le plus récent `updatedAt` de ses lignes.
