---
id: US-254
titre: Charger une nouvelle version quand je le décide
statut: terminée
epic: EPIC-061
regles: [R14]
adr: [ADR-0093, ADR-0078]
---

# US-254 : Charger une nouvelle version quand je le décide

En tant qu'organisatrice ou participante, je veux que Limbus me propose sa nouvelle version sans recharger la page, afin de ne jamais perdre une saisie ni être interrompue pendant que je navigue.

## Critères d'acceptation

- [x] Étant donné qu'une nouvelle version attend, quand je change de page, alors rien ne se recharge, et un bandeau en bas de l'écran dit « Une nouvelle version de Limbus est disponible », avec « Recharger » et une croix.
- [x] Étant donné ce bandeau, quand je choisis « Recharger », alors la page se recharge dans la nouvelle version, et le bandeau a disparu.
- [x] Étant donné ce bandeau, quand je choisis la croix, alors il disparaît jusqu'au prochain chargement complet de la page, ou jusqu'à ce qu'une version plus récente attende.
- [x] Étant donné deux onglets ouverts sur Limbus, quand je choisis « Recharger » dans l'un, alors l'autre ne se recharge pas et garde son bandeau ; « Recharger » y recharge aussitôt. Seule exception, acceptée : s'il change de page vers un écran dont le fichier n'était pas chargé, Nuxt le recharge, car ce fichier n'existe plus.
- [x] Étant donné que le réseau manque, ou que le serveur est indisponible, alors le bandeau est masqué, et il revient avec le réseau.
- [x] Le rechargement de secours qui partait 4 secondes après un changement de page n'existe plus.
- [x] Le bandeau ne masque rien, sur téléphone compris : la page lui réserve sa hauteur.

## Notes techniques

- `plugins/serviceWorker.client.ts` : `onNeedReload` passé à `registerSW`, qui ne recharge que si « Recharger » a été choisi dans l'onglet ; `onNeedRefresh` rouvre le bandeau fermé.
- `utils/pwaUpdate.ts` : `afterNavigation` ne fait plus que chercher une version ; une fonction applique la mise à jour (activer la version en attente, sinon recharger), testée en unitaire.
- `components/AppUpdateBanner.vue`, monté une fois dans `app.vue`, pour toutes les pages.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : une version qui attend affiche le bandeau sans recharger au changement de page ; « Recharger » recharge ; la croix le ferme.
- Erreurs de saisie : sans objet, le bandeau ne demande aucune saisie.
- Droits : sans objet, le bandeau est le même pour tout compte et sans compte ; il n'appelle aucune route.
- Hors ligne : sans réseau, le bandeau est masqué, et revient avec le réseau.

Tests unitaires de `utils/pwaUpdate.ts`.

Écrits : `tests/e2e/pwaUpdate.spec.ts` (une version qui attend : bandeau, changement de page sans rechargement, place réservée, masqué hors ligne, croix, « Recharger » ; deux onglets : « Recharger » dans l'un ne recharge pas l'autre) et `tests/utils/pwaUpdate.test.ts`. Le test des deux onglets échoue sans `onNeedReload` : il reproduit le défaut d'origine.

Le déploiement est simulé dans le contexte du test, sans toucher au fichier du serveur partagé par les autres tests : le service worker est d'abord mis en service sous `/sw.js?version=ancienne`, et `/sw.js`, inscrit par Limbus au chargement suivant, devient la nouvelle version. Playwright n'intercepte pas la requête du script d'un service worker (essayé : `context.route`, `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`, `Fetch` au niveau du navigateur).
