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

- **Téléchargement** : le navigateur lit, une par une, les adresses que liraient les pages du jeu, et garde chaque réponse comme si la page l'avait ouverte (même clé, mêmes magasins). Ces adresses viennent d'un plan unique (`utils/offlinePlan.ts`), que les pages et le téléchargement partagent, pour qu'elles ne divergent pas ; un test de bout en bout télécharge un jeu, coupe le réseau et ouvre chaque page. Les PDF et photos des sessions à venir sont lus par `fetch` et rangés par le navigateur dans un cache à part, `offline-downloads` (`caches.open(...).put`), sans limite de nombre ni de durée : les caches du service worker (200 PDF, 300 photos, 30 jours) les évinceraient. Le service worker les sert depuis ce cache quand le réseau manque, avant ses propres caches. Aucune route serveur n'est ajoutée, sauf pour lire le contact d'urgence et les allergies de tous les participants d'un jeu d'un coup, si la lecture fiche par fiche est trop lente.
- **Élément en attente** : une réponse n'écrase pas un élément qui a une écriture dans la file ; sa copie « en attente » reste ([ADR-0036](ADR-0036-protocole-de-resynchronisation.md)).
- **Registre** : un magasin `offlineDownloads` de la base IndexedDB garde, par jeu (ou pour « mes sessions à venir »), la date du dernier téléchargement complet, les clés de réponses et les adresses de fichiers écrites, avec leur taille.
- **Mise à jour** : à l'ouverture de Limbus et à l'événement `online`, chaque jeu du registre dont le téléchargement a plus d'une heure se télécharge de nouveau, en arrière-plan, un jeu à la fois. Un 403 ou un 404 sur le jeu lui-même efface le jeu de l'appareil : ses clés de réponses et ses fichiers, sauf ceux qu'un autre téléchargement du registre a aussi écrits, et ses lignes dans les magasins de listes, qui mêlent les jeux (filtre sur `gameId`). Une réponse de liste qui mêle plusieurs jeux est relue au lieu d'être effacée.
- **Place prise** : la taille des données est la somme des enregistrements de la base (JSON sérialisé) et, pour les fichiers, de l'en-tête `Content-Length` des réponses gardées, sans lire leur contenu ; la place totale vient de `navigator.storage.estimate()`.
- **Désactivation** : un réglage de l'appareil (`localStorage`, clé `limbusOfflineDisabled`), que la déconnexion n'efface pas. Activée, elle vide la base, les caches et l'identité hors ligne, et désinscrit le service worker. Tant qu'elle dure, `useApiFetch` ne garde aucune réponse et ne met rien en file, `rememberOfflineAuth` garde l'identité en mémoire seulement (une coupure de réseau ne ferme pas la page ouverte), et le service worker n'est pas réinscrit au chargement : l'inscription passe par `plugins/serviceWorker.client.ts`, à la place de celle du module (`client.registerPlugin: false`). La réactiver le réinscrit.

## Conséquences

- Le téléchargement suit l'évolution des pages, à condition qu'une nouvelle lecture passe par le plan : la règle des tests (ADR-0079) le vérifie par le test hors ligne de l'écran.
- Un jeu se télécharge en autant de requêtes que de pages : lent sur un gros jeu, mais suivi par l'avancement (SPEC-019, R11).
- Sans service worker, Limbus ne s'ouvre plus du tout sans réseau sur un appareil désactivé, ce qui est le but.

## Options écartées

- **Une route serveur qui renvoie tout un jeu d'un coup** : il faudrait redécouper le paquet selon les adresses des pages, et tenir deux descriptions de ce que lit chaque page.
- **Synchronisation en arrière-plan du navigateur (Background Sync, Periodic Background Sync)** : absente de Safari et de Firefox ; la mise à jour se fait donc quand Limbus est ouvert.
- **Garder la file des modifications quand le hors ligne est désactivé** : écarté par l'utilisatrice (SPEC-019, R6).
- **Désactiver sans retirer le service worker** : il continuerait de garder PDF et photos, que la configuration de Workbox ne permet pas de conditionner à un réglage de l'appareil.
