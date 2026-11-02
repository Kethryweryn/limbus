---
id: ADR-0057
titre: Interface en TypeScript strict, réponses déduites des routes Nitro, règle de lint étendue lot par lot
statut: accepté
date: 2026-11-02
liens: [../archive/todo/interface-en-typescript.md, ../revues/2026-10-29-architecture.md, ADR-0036-protocole-de-resynchronisation.md]
---

# ADR-0057 : Interface en TypeScript strict, réponses déduites des routes Nitro, règle de lint étendue lot par lot

## Contexte

La quasi-totalité des pages et composants est en JavaScript (revue d'architecture, R-10). `npm run typecheck` ne vérifie donc pas l'interface. Choix de l'utilisatrice :

- réponses déduites du serveur ;
- vérification stricte dès le départ ;
- une PR par domaine ;
- gros écrans découpés au passage.

## Décision

- **Appels** : `useApiFetch` a la signature de `$fetch`. La réponse vient de `TypedInternalResponse` de Nitro, pour la route appelée et la méthode écrite dans l'appel (`method: 'POST'`). Une écriture rend aussi, possiblement, `OfflineQueuedResponse` : sa mise en file hors ligne, que l'appelant distingue par `isOfflineQueued`.
  - La méthode n'est pas déduite des routes (`ExtractedRouteMethod`). Avec plus de 150 routes, TypeScript dépasse sa profondeur de comparaison en contexte générique.
  - L'implémentation reste non typée par route : la file hors ligne et le cache de l'appareil ne connaissent que l'URL.
  - Une action (envoi, partage, legs, téléversement), jamais mise en file, passe par `useApiAction` : même signature, réponse du serveur seule.
  - Un état se type par `ApiResponse<'/api/games/:id'>`, la route sous sa forme Nitro.
  - La réponse est marquée `NoInfer` : sans cela, la cible d'une affectation (`ref.value = await useApiFetch(…)`) relançait la déduction de la route et dépassait la profondeur de comparaison.
- **Réponses ambiguës** : une route qui rend des formes différentes les distingue par un champ littéral (`authenticated: true as const`), que l'interface teste.
- **Erreurs** : `apiErrorMessage` et `serverMessage` (`utils/apiErrors.ts`) lisent le message du serveur, sans `any` dans les `catch`.
- **Écrans découpés** : un écran à plusieurs sections (documents, paiements d'une session) garde son état et ses actions dans un composable qu'il fournit (`provide`) à ses sections (`useSessionDocumentActions`, `useSessionPaymentActions`) : les sections ne se passent pas une dizaine de propriétés.
- **Listes hors ligne** : `fetchOfflineList` (lecture sur l'appareil ou par l'API, gardée sur l'appareil) et `useConnectionRefresh` (relecture au changement de connexion), dans `composables/useOfflineList.ts`, remplacent le code recopié dans chaque page de liste.
- **Types d'interface partagés** : `utils/ui.ts` (couleurs Nuxt UI), `utils/navigation.ts` (menu).
- **Éléments en cours d'édition** : le type de l'élément rendu par l'API, sans ses éléments liés, que le formulaire tient en identifiants (`utils/writingDrafts.ts`). Un champ texte facultatif se lie avec `v-model.nullable` : vidé, il vaut `null`, comme en base.
- **Règle** : `eslint.config.mjs` liste les fichiers convertis (`TYPED_INTERFACE`) et y impose `vue/block-lang` (`lang="ts"`) et `no-explicit-any` en erreur. La liste grandit à chaque lot. Le dernier la remplace par tous les `.vue`.

## Conséquences

- Une route qui change la forme de sa réponse fait échouer `typecheck` dans les écrans qui la lisent.
- Pendant la migration, un fichier non encore converti n'est pas vérifié. L'ordre des lots suit les domaines, pas les risques.
- Les `any` hérités du serveur restent des avertissements, hors du périmètre de cet epic.

## Options écartées

- **Types écrits à la main** : à maintenir deux fois, et ils divergent sans qu'aucune vérification ne le voie.
- **Méthode déduite des routes** : exacte, mais elle fait échouer la vérification par excès de profondeur.
- **Une seule PR** : impossible à relire.
