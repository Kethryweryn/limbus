---
id: ADR-0071
titre: Une nouvelle version de l'application se charge au changement de page
statut: accepté
date: 2026-11-08
liens: [../specs/SPEC-010-hors-ligne.md, ADR-0012-donnees-hors-ligne.md]
---

# ADR-0071 : Une nouvelle version de l'application se charge au changement de page

## Contexte

Limbus est une PWA servie par `@vite-pwa/nuxt` en mode `autoUpdate` : après un déploiement, le nouveau service worker s'installe, prend la main et recharge aussitôt chaque onglet ouvert. La documentation de vite-plugin-pwa prévient que ce mode peut faire perdre une saisie en cours, et conseille le mode `prompt` pour une application avec des formulaires. Le cas s'est produit sur téléphone (retour A6-2 du cahier de tests) : la page s'est rechargée pendant la saisie d'un mot de passe.

## Décision

- Le module passe en mode `prompt` : une nouvelle version attend, sans rien recharger.
- `plugins/pwaUpdate.client.ts` la charge au prochain changement de page : juste après la navigation, si une version attend, le nouveau service worker est activé et le module recharge la page arrivée, où rien n'a encore été saisi. Si le service worker ne prend pas la main sous 4 secondes, la page se recharge quand même (`utils/pwaUpdate.ts`). Agir après la navigation laisse l'historique tel que l'application l'a écrit, ajout ou remplacement.
- Un changement de la seule requête (onglet, filtre, `?edit=1`) n'est pas un changement de page.
- Hors ligne, ou quand le serveur est marqué indisponible, rien ne change : recharger une page qu'on ne peut pas servir laisserait l'écran vide.
- Pas de bandeau : celui de `layouts/default.vue` (en anglais, jamais visible en mode `autoUpdate`) est retiré.

## Conséquences

- Une personne qui reste sur la même page garde l'ancienne version jusqu'à ce qu'elle en change ou ferme l'onglet. Une saisie ne se perd plus à cause d'un déploiement.
- Le premier déploiement de ce réglage ne recharge rien : les onglets ouverts avec l'ancienne version gardent l'ancien service worker jusqu'à leur fermeture.
- Un changement de page vers une nouvelle version coûte un chargement complet au lieu d'une navigation dans l'application, une fois par déploiement.

La recherche de la nouvelle version, qui ne se faisait qu'au chargement complet d'une page, est complétée par [ADR-0078](ADR-0078-recherche-de-la-nouvelle-version.md).

## Options écartées

- **Garder `autoUpdate`** : c'est la cause du défaut.
- **Bandeau « Nouvelle version » avec un bouton** : écarté par l'utilisatrice, qui préfère que la mise à jour se fasse sans rien demander, au changement de page.
