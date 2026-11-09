---
id: US-196
titre: Repérer une nouvelle version sans recharger la page
statut: terminée
epic: EPIC-045
regles: [R14]
adr: [ADR-0071, ADR-0078]
---

# US-196 : Repérer une nouvelle version sans recharger la page

En tant que personne qui utilise Limbus, je veux que la nouvelle version soit repérée pendant que je navigue, afin qu'elle se charge dans les changements de page qui suivent le déploiement, et pas au hasard (retour du 2026-11-09 : trois minutes de navigation avant le rechargement).

## Critères d'acceptation

- [x] Étant donné Limbus ouvert, quand je change de page en ligne, alors Limbus demande au serveur s'il existe une nouvelle version, une fois par minute au plus.
- [x] Étant donné une page restée ouverte, alors Limbus le demande aussi toutes les heures.
- [x] Hors ligne, ou quand le serveur est indisponible, ou pendant le téléchargement d'une version, Limbus ne demande rien.
- [x] Une nouvelle version repérée se charge toujours au changement de page suivant, jamais sur la page ouverte (US-184).

## Notes techniques

Le navigateur ne cherche un nouveau service worker qu'au chargement complet d'une page : une navigation dans l'application n'en déclenche aucune, et `@vite-pwa/nuxt` ne vérifie rien de lui-même (`periodicSyncForUpdates` vaut 0). `utils/pwaUpdate.ts` (`checkForNewVersion`), `plugins/pwaUpdate.client.ts`, `nuxt.config.ts` (`pwa.client.periodicSyncForUpdates`). [ADR-0078](../../adr/ADR-0078-recherche-de-la-nouvelle-version.md). Choix de l'utilisatrice le 2026-11-09 : à chaque changement de page, une fois par minute au plus, et toutes les heures.

## Tests

`tests/utils/pwaUpdate.test.ts`. Le passage d'une version à l'autre ne se joue pas dans Playwright, qui ne déploie pas deux versions.
