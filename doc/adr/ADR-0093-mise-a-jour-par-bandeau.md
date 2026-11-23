---
id: ADR-0093
titre: Une nouvelle version se charge depuis un bandeau, jamais d'elle-même
statut: accepté
date: 2026-11-17
liens: [../specs/SPEC-010-hors-ligne.md, ADR-0071-mise-a-jour-au-changement-de-page.md, ADR-0078-recherche-de-la-nouvelle-version.md, ../archive/todo/mise-a-jour-par-bandeau.md]
---

# ADR-0093 : Une nouvelle version se charge depuis un bandeau, jamais d'elle-même

## Contexte

[ADR-0071](ADR-0071-mise-a-jour-au-changement-de-page.md) recharge la page au changement de page qui suit une nouvelle version. L'utilisatrice voit encore des rechargements pendant qu'elle navigue ou écrit. Le code en montre deux causes, en plus du rechargement au changement de page lui-même :

- `registerSW` (vite-plugin-pwa 1.3.0, mode `prompt`) écoute l'événement `controlling` de workbox-window dès qu'un onglet a repéré la nouvelle version, et recharge cet onglet quand elle prend la main, sauf si `onNeedReload` est fourni. Le changement de page d'un autre onglet, qui active la version, recharge donc tous les autres.
- Le rechargement de secours d'ADR-0071 part 4 secondes après la navigation, quoi qu'on ait commencé à saisir.

web.dev ([« Update »](https://web.dev/learn/pwa/update)) et la documentation de Workbox ([« Handling service worker updates »](https://developer.chrome.com/docs/workbox/handling-service-worker-updates)) recommandent de prévenir qu'une version attend, et de laisser la personne recharger quand cela lui convient.

## Décision

- Le module reste en mode `prompt`. `plugins/pwaUpdate.client.ts` ne recharge plus rien au changement de page : il y cherche seulement une nouvelle version, comme toutes les heures ([ADR-0078](ADR-0078-recherche-de-la-nouvelle-version.md), inchangé).
- Une version qui attend affiche un bandeau en bas de l'écran, en haut de la page depuis la note du 2026-11-18, et collé en haut de l'écran depuis celle du 2026-11-20 (`components/AppUpdateBanner.vue`), sur toutes les pages : « Une nouvelle version de Limbus est disponible », « Recharger » et une croix. Il est masqué sans réseau et quand le serveur est indisponible, car une page rechargée ne pourrait pas être servie.
- « Recharger » active la version en attente (`updateServiceWorker`), et recharge l'onglet quand elle a pris la main, ou après 4 secondes si elle ne la prend pas. Si la version a déjà été activée par un autre onglet, l'onglet se recharge aussitôt.
- `registerSW` reçoit `onNeedReload` : la prise de main par la nouvelle version ne recharge l'onglet que si on y a choisi « Recharger ». Les autres onglets gardent leur bandeau.
- La croix ferme le bandeau jusqu'au prochain chargement complet de la page, ou jusqu'à ce qu'une version plus récente attende.
- Sans clic, la version s'active d'elle-même quand tous les onglets de Limbus sont fermés : c'est le fonctionnement par défaut du navigateur.
- Une version qui attend n'arrête plus la recherche d'[ADR-0078](ADR-0078-recherche-de-la-nouvelle-version.md) : une version plus récente rouvre le bandeau fermé (revue de la PR #260).
- Le bandeau est annoncé aux lecteurs d'écran (`role="status"`) ; tant qu'il est affiché, les toasts passent au-dessus de lui (jusqu'à la note du 2026-11-18 : en haut de la page, il ne les croise plus).

## Conséquences

- Une page ne se recharge plus d'elle-même à cause d'un déploiement : ni pendant une saisie, ni pendant une navigation, ni depuis un autre onglet, à l'exception décrite plus bas.
- Une personne qui ignore le bandeau garde l'ancienne version tant qu'un onglet de Limbus reste ouvert : l'ancien service worker sert les fichiers de l'ancienne version.
- Un onglet resté ouvert après qu'un autre a choisi « Recharger » tourne avec l'ancienne page sous le nouveau service worker, qui n'a plus les fichiers de l'ancienne version, et le serveur non plus. Son bandeau reste affiché. S'il change de page vers un écran dont le fichier n'était pas encore chargé, Nuxt recharge la page (`emitRouteChunkError`, par défaut), car l'écran resterait sinon blanc : c'est la seule exception à R14, acceptée par l'utilisatrice.
- Le bandeau, fixé en bas de l'écran, ne masque rien : la page lui réserve sa hauteur tant qu'il est affiché. Remplacé le 2026-11-18 : voir la note plus bas.
- Le rechargement qui suivait l'envoi des modifications faites hors ligne (R7) disparaît aussi : la page relit ses données sans recharger l'application ([US-255](../archive/epics/EPIC-061-mise-a-jour-par-bandeau/US-255-retour-du-reseau-sans-rechargement.md)).

## Options écartées

- **Garder le rechargement au changement de page, corrigé** (un onglet ne se recharge qu'à son propre changement de page, sans secours) : proposé à l'utilisatrice, qui a choisi le bandeau.
- **Le bandeau et le rechargement au changement de page** : écarté pour la même raison.
- **Bandeau toujours visible, ou pastille dans la barre du haut** : l'utilisatrice a choisi un bandeau en bas, qu'on peut fermer.
- **Bandeau visible sans réseau, bouton grisé** : l'utilisatrice a choisi de le masquer.

## Note du 2026-11-18

À la demande de l'utilisatrice ([US-256](../archive/epics/EPIC-062-bandeau-en-haut/US-256-bandeau-en-haut.md)), le bandeau quitte le bas de l'écran : il s'affiche tout en haut de la page, au-dessus de la barre du logo, comme les bandeaux « Pas de connexion au serveur » et « Modifications faites hors ligne ». Il pousse la page vers le bas et défile avec elle ; il ne recouvre donc rien, et les toasts, en bas de l'écran, n'ont plus à passer au-dessus de lui. Sa zone annoncée aux lecteurs d'écran reste dans la page, vide sans version qui attend, pour que son texte soit lu quand il apparaît (revue de la PR #265). Le reste de la décision ne change pas.

## Note du 2026-11-23

`@vite-pwa/nuxt` passe en version 2 (PR #272) : `registerSW` vient maintenant de `@unplugin-pwa/core` et non plus de `vite-plugin-pwa`, sa fonction de mise à jour ne prend plus de paramètre, et l'option `workbox` s'appelle `generateSW`. Les rappels sur lesquels repose cette décision (`onNeedRefresh`, `onNeedReload`, `onRegisteredSW`) existent toujours ; `tests/e2e/pwaUpdate.spec.ts` et les tests du hors ligne passent avec cette version. La décision ne change pas.

## Note du 2026-11-20

À la demande de l'utilisatrice ([US-257](../archive/epics/EPIC-063-retours-du-test-a13/US-257-bandeaux-qui-suivent-le-defilement.md), retour A13-2 du cahier de tests), le bandeau ne défile plus avec la page : avec les bandeaux « Pas de connexion au serveur » et « Modifications faites hors ligne », il reste collé en haut de l'écran. En haut de la page, il pousse toujours la page vers le bas ; plus bas, il recouvre le haut de ce qui défile, de sa propre hauteur. Les trois bandeaux sont dans un même bloc collé (`sticky`), et la racine de l'application isole son empilement pour que les fenêtres de Nuxt UI passent au-dessus.
