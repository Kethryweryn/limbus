---
id: ADR-0078
titre: Limbus cherche une nouvelle version à chaque changement de page et toutes les heures
statut: accepté
date: 2026-11-09
liens: [ADR-0071-mise-a-jour-au-changement-de-page.md, ../specs/SPEC-010-hors-ligne.md]
---

# ADR-0078 : Limbus cherche une nouvelle version à chaque changement de page et toutes les heures

## Contexte

ADR-0071 charge une nouvelle version au changement de page qui suit son arrivée. Encore faut-il que le navigateur la trouve. Il ne cherche un nouveau service worker qu'au chargement complet d'une page dans son périmètre, ou après un événement du service worker si la dernière recherche date de plus de 24 heures ([web.dev, « Update »](https://web.dev/learn/pwa/update)). Une navigation dans l'application n'est pas un chargement complet. `@vite-pwa/nuxt` peut chercher à intervalle régulier (`client.periodicSyncForUpdates`), mais l'option vaut 0 par défaut. Après un déploiement, une personne déjà sur Limbus pouvait donc naviguer longtemps dans l'ancienne version : trois minutes le 2026-11-09.

## Décision

- Après chaque changement de page fait en ligne, serveur joignable, `plugins/pwaUpdate.client.ts` appelle `registration.update()`, une fois par minute au plus (`checkForNewVersion`, `utils/pwaUpdate.ts`). Rien n'est demandé pendant qu'une version se télécharge, ni quand une version attend déjà : elle se charge alors (ADR-0071).
- Le module cherche aussi toutes les heures (`periodicSyncForUpdates: 3600`), pour une page restée ouverte.
- La version trouvée se télécharge en arrière-plan et se charge au changement de page suivant, selon ADR-0071 : jamais sur la page ouverte.

## Conséquences

- Après un déploiement, la nouvelle version se charge en général au deuxième changement de page : le premier la repère, elle se télécharge, le suivant la charge.
- Une recherche coûte une requête du fichier `sw.js`, sans cache, au plus une fois par minute de navigation.

## Options écartées

- **Chercher toutes les minutes, même sans navigation** : un onglet oublié interrogerait le serveur en permanence.
- **Chercher toutes les heures seulement** : une nouvelle version pourrait attendre une heure.
