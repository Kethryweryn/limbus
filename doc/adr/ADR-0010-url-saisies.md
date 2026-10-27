---
id: ADR-0010
titre: URL saisies limitées à http(s), YouTube seul intégré, téléchargement serveur borné
statut: accepté
date: 2026-10-27
liens: [ADR-0008]
---

# ADR-0010 : URL saisies limitées à http(s), YouTube seul intégré, téléchargement serveur borné

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

Plusieurs champs acceptent une URL : teaser, documents de contexte, photos, RIB, lien de paiement. Ils étaient acceptés tels quels :

- une URL `javascript:` s'exécutait dans un lien ou dans l'iframe du teaser, y compris sur la page publique d'un jeu ;
- la génération du trombinoscope téléchargeait côté serveur n'importe quelle URL de photo, y compris vers le réseau interne (SSRF).

## Décision

- Les URL saisies passent par les schémas zod `externalUrl` (http ou https uniquement) ou `uploadOrExternalUrl(prefix)` (http(s), ou fichier téléversé sous le préfixe attendu).
- Seul YouTube est intégré en iframe : `youtubeEmbedUrl` reconstruit l'URL d'intégration à partir de l'identifiant de la vidéo. Tout autre teaser s'affiche en simple lien (« Voir le teaser »).
- Le serveur ne télécharge une image externe que par `fetchPublicImage` :
  - l'hôte doit résoudre vers une adresse publique (adresses privées, locales et réservées refusées) ;
  - aucune redirection n'est suivie ;
  - le délai est de 5 secondes, la taille de 5 Mo au plus.

## Conséquences

- Les données existantes non conformes ne sont pas réécrites : elles sont refusées à la prochaine modification, et l'affichage ne les intègre plus.
- Un teaser Vimeo ou autre n'est pas intégré ; ajouter un hébergeur demande un ADR et une fonction de construction d'URL dédiée.
- Une image sur un hôte qui redirige (raccourcisseur d'URL) n'est pas récupérée : le trombinoscope signale une photo manquante.
- Un hôte qui change de résolution DNS entre la vérification et la connexion (DNS rebinding) n'est pas couvert ; risque jugé faible ici.

## Options écartées

- **Liste noire de schémas (`javascript:`, `data:`…)** : toujours incomplète ; une liste blanche est sûre par construction.
- **Iframe générique avec `sandbox`** : réduit le risque sans le supprimer, et laisse intégrer n'importe quel contenu sur la page publique.
