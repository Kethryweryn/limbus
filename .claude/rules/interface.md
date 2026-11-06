---
paths:
  - "pages/**"
  - "components/**"
  - "layouts/**"
  - "composables/**"
  - "utils/**"
  - "app.vue"
  - "error.vue"
---

# Conventions UI

- Nuxt UI v4 : le contenu d'un `UModal` va dans le slot `#body`, sinon il s'affiche dans la page.
- Chaque page doit avoir un seul élément racine dans son template.
- TypeScript strict (ADR-0057) : tout composant et toute page sont en `<script setup lang="ts">`, sans `any` : la règle de lint (`eslint.config.mjs`) impose `lang="ts"` à tous les `.vue` et refuse tout `any` dans le dépôt, tests et scripts compris. Les appels passent par `useApiFetch`, typé par la route, et ceux d'une page publique (lien personnel, présence, invitation) par `publicFetch` ; une écriture se teste avec `isOfflineQueued`, une action passe par `useApiAction`, un état se type avec `ApiResponse`. Une page de liste lit avec `fetchOfflineList` et se relit avec `useConnectionRefresh` ; une liste sans magasin propre lit avec `useApiFetch(url, { offlineCache: true })`, car un nouveau magasin IndexedDB demande de changer la version de la base (`utils/storage.ts`).
- Hors ligne : la déconnexion efface tout ce qui est sur l'appareil (`clearOfflineData`), et la connexion d'un autre compte aussi (`claimOfflineData`). Seul un 401 renvoie à l'écran de connexion ; un 403 est un refus ponctuel.
- Hors ligne : les écritures sont mises en file (`utils/offlineSync.ts`) et rejouées avec la version lue, suppressions et sous-routes comprises (ADR-0036). Une page à consulter hors ligne lit avec `useApiFetch(url, { offlineCache: true })` (ou `useOfflineFetch` si elle est rendue côté serveur). Une modification qui porte sur une ligne sans `updatedAt` propre envoie la version de ce qu'elle a lu (`NO_VERSION` si la ligne n'existe pas). Un POST ou un DELETE sur une sous-route (envoi d'emails, génération, legs, partages…) est une action : jamais mis en file.
