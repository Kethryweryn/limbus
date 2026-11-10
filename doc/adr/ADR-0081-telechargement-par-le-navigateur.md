---
id: ADR-0081
titre: Téléchargement hors ligne par le navigateur, qui rejoue les lectures des pages ; désactivation par appareil
statut: accepté
date: 2026-11-10
liens: [../specs/SPEC-019-hors-ligne-dans-le-compte.md, ../specs/SPEC-010-hors-ligne.md, ADR-0012-donnees-hors-ligne.md, ADR-0036-protocole-de-resynchronisation.md]
---

# ADR-0081 : Téléchargement hors ligne par le navigateur, qui rejoue les lectures des pages ; désactivation par appareil

## Contexte

Sans réseau, une page se rouvre à partir de la réponse gardée sous l'adresse qu'elle a lue (`saveCachedResponse`, clé = URL), des listes gardées par entité, et des PDF et photos gardés par le service worker. [SPEC-019](../specs/SPEC-019-hors-ligne-dans-le-compte.md) demande de tout garder à l'avance pour un jeu, de mesurer et d'effacer ce qui est gardé, et de pouvoir ne rien garder du tout sur un appareil.

## Décision

- **Téléchargement** : le navigateur lit, une par une, les adresses que liraient les pages du jeu, et garde chaque réponse comme si la page l'avait ouverte (même clé, mêmes magasins). Ces adresses viennent d'un plan unique (`utils/offlinePlan.ts`), que les pages et le téléchargement partagent, pour qu'elles ne divergent pas ; un test de bout en bout télécharge un jeu, coupe le réseau et ouvre chaque page. Les PDF et photos des sessions à venir sont lus par `fetch`, ce qui les fait garder par le service worker comme aujourd'hui. Aucune route serveur n'est ajoutée, sauf pour lire le contact d'urgence et les allergies de tous les participants d'un jeu d'un coup, si la lecture fiche par fiche est trop lente.
- **Élément en attente** : une réponse n'écrase pas un élément qui a une écriture dans la file ; sa copie « en attente » reste ([ADR-0036](ADR-0036-protocole-de-resynchronisation.md)).
- **Registre** : un magasin `offlineDownloads` de la base IndexedDB garde, par jeu (ou pour « mes sessions à venir »), la date du dernier téléchargement complet et les clés écrites, ce qui permet d'effacer un jeu dont l'accès est perdu sans toucher au reste.
- **Mise à jour** : à l'ouverture de Limbus et à l'événement `online`, chaque jeu du registre dont le téléchargement a plus d'une heure se télécharge de nouveau, en arrière-plan, un jeu à la fois. Un 403 ou un 404 sur le jeu lui-même efface ses clés du registre.
- **Place prise** : la taille des données est la somme des enregistrements de la base (JSON sérialisé) et des réponses des caches de PDF et de photos ; la place totale vient de `navigator.storage.estimate()`.
- **Désactivation** : un réglage de l'appareil (`localStorage`, clé `limbusOfflineDisabled`), que la déconnexion n'efface pas. Activée, elle vide la base, les caches et l'identité hors ligne, et désinscrit le service worker. Tant qu'elle dure, `useApiFetch` ne garde aucune réponse et ne met rien en file, et le service worker n'est pas réinscrit au chargement. La réactiver le réinscrit.

## Conséquences

- Le téléchargement suit l'évolution des pages, à condition qu'une nouvelle lecture passe par le plan : la règle des tests (ADR-0079) le vérifie par le test hors ligne de l'écran.
- Un jeu se télécharge en autant de requêtes que de pages : lent sur un gros jeu, mais suivi par l'avancement (SPEC-019, R11).
- Sans service worker, Limbus ne s'ouvre plus du tout sans réseau sur un appareil désactivé, ce qui est le but.

## Options écartées

- **Une route serveur qui renvoie tout un jeu d'un coup** : il faudrait redécouper le paquet selon les adresses des pages, et tenir deux descriptions de ce que lit chaque page.
- **Synchronisation en arrière-plan du navigateur (Background Sync, Periodic Background Sync)** : absente de Safari et de Firefox ; la mise à jour se fait donc quand Limbus est ouvert.
- **Garder la file des modifications quand le hors ligne est désactivé** : écarté par l'utilisatrice (SPEC-019, R6).
- **Désactiver sans retirer le service worker** : il continuerait de garder PDF et photos, que la configuration de Workbox ne permet pas de conditionner à un réglage de l'appareil.
