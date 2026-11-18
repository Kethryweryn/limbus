---
titre: Une nouvelle version se charge quand on le décide
statut: prête
date: 2026-11-17
spec: ../../specs/SPEC-010-hors-ligne.md
epic: ../epics/EPIC-061-mise-a-jour-par-bandeau/README.md
---

# Une nouvelle version se charge quand on le décide

## Besoin

Après un déploiement, la page se recharge encore pendant que l'utilisatrice navigue ou écrit. R14 de [SPEC-010](../../specs/SPEC-010-hors-ligne.md) charge la nouvelle version au changement de page qui suit ([ADR-0071](../../adr/ADR-0071-mise-a-jour-au-changement-de-page.md)). Deux défauts s'y ajoutent, relevés dans le code :

- `registerSW` de vite-plugin-pwa (`dist/client/build/register.js`, version 1.3.0) recharge un onglet dès que la nouvelle version prend la main, si cet onglet l'a repérée. Un changement de page dans un autre onglet, ou dans la fenêtre de l'application, recharge donc l'onglet où l'on écrit.
- Un rechargement de secours part 4 secondes après le changement de page, même si une saisie a commencé sur la page arrivée.

## Ce que disent les bonnes pratiques

- [web.dev, « Update »](https://web.dev/learn/pwa/update) : prévenir qu'une mise à jour attend, et laisser la personne recharger quand cela lui convient ; éviter d'imposer `skipWaiting()`.
- [Chrome, « Handling service worker updates »](https://developer.chrome.com/docs/workbox/handling-service-worker-updates) : proposer le rechargement, et ne recharger qu'une fois la mise à jour acceptée ; sinon, la nouvelle version s'active d'elle-même quand tous les onglets sont fermés.
- [vite-plugin-pwa, « Prompt for update »](https://vite-pwa-org.netlify.app/guide/prompt-for-update) : en mode `prompt`, montrer un bandeau avec « Recharger » dans `onNeedRefresh`.

## Proposition (choix de l'utilisatrice du 2026-11-17)

- Plus aucun rechargement automatique : ni au changement de page, ni depuis un autre onglet, ni de secours.
- Un bandeau en bas de l'écran, « Une nouvelle version de Limbus est disponible », avec « Recharger » et une croix.
- Fermé, il revient au prochain chargement de la page, ou quand une version plus récente arrive.
- Sans réseau, ou serveur indisponible, il est masqué, et revient avec le réseau.
- Sans clic, la nouvelle version se charge d'elle-même quand tous les onglets de Limbus sont fermés.
- La recherche de la nouvelle version reste celle d'[ADR-0078](../../adr/ADR-0078-recherche-de-la-nouvelle-version.md).
- Seule exception : un onglet resté sur l'ancienne version après « Recharger » dans un autre se recharge au changement de page qui demande un fichier disparu (accepté).
- Au retour du réseau, l'envoi des modifications faites hors ligne ne recharge plus la page : elle relit ses données (relevé par la revue de la PR #259).

## Découpage envisagé

Un lot : [EPIC-061](../epics/EPIC-061-mise-a-jour-par-bandeau/README.md).

## Points à trancher

Aucun.
