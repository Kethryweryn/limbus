---
id: US-114
titre: Fondations : appels typés, mise en page, composants communs, pages d'accès
statut: terminée
epic: EPIC-031
regles: []
adr: [ADR-0057]
---

# US-114 : Fondations : appels typés, mise en page, composants communs, pages d'accès

En tant que développeuse, je veux que les appels à l'API soient typés par leur route, et que les pièces communes de l'interface soient vérifiées.

## Critères d'acceptation

- [x] `useApiFetch` déduit la réponse de la route et de la méthode, comme `$fetch`. Une écriture peut rendre sa mise en file hors ligne (`OfflineQueuedResponse`, `isOfflineQueued`). `useOfflineFetch` aussi.
- [x] La mise en page, le menu, les composants communs et les pages d'accès, de déconnexion et légales sont en TypeScript strict.
- [x] La règle de lint (`vue/block-lang`, `no-explicit-any` en erreur) couvre ces fichiers.

## Tests

- `npm run typecheck` sur ces fichiers ; une erreur volontaire est bien détectée.
