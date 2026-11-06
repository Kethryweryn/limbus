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
- Écritures concurrentes : `assertUnmodifiedSince` (`server/utils/concurrency.ts`) ; `assertRowsVersion` pour une liste remplacée d'un bloc, dont la version est le plus récent `updatedAt` de ses lignes.
