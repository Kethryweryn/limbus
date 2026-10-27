---
id: ADR-0008
titre: Fichiers téléversés servis sous contrôle et supprimés quand plus personne ne les référence
statut: accepté
date: 2026-10-27
liens: [ADR-0007, ADR-0009, ADR-0011]
---

# ADR-0008 : Fichiers téléversés servis sous contrôle, supprimés quand plus personne ne les référence

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

Les organisatrices téléversent des photos (attributions de session, trombinoscope) et des RIB. Ce sont des données personnelles. Avant, les fichiers restaient sur le disque après la suppression ou le remplacement de ce qui les référençait. Une même photo peut aussi servir à plusieurs sessions.

## Décision

- Les fichiers sont stockés sous `.data/uploads/<type>/` et servis par des routes qui vérifient les droits, jamais en statique.
- À l'envoi, on vérifie le type réel du fichier par sa signature (pas par son extension ni son type MIME déclaré) et on le renomme avec un UUID.
- Une URL de fichier téléversé n'est acceptée que sous le préfixe attendu et avec un nom de la forme `[\w-]+\.[a-z]+` (`isUploadUrl`), ce qui exclut toute traversée de chemin.
- Toute modification ou suppression qui retire une référence appelle ensuite `deleteUnusedUploads(urls)`. Celle-ci vérifie qu'aucune attribution, aucun personnage, aucune session ne référence encore le fichier, puis supprime la ligne `UploadedFile` et le fichier.
- Avant une suppression en cascade (jeu, session, personnage), on relève les URL avec `collectUploadUrls`, puisque la cascade efface les références.
- Les participants n'ont pas de compte : un fichier qui leur est destiné (RIB) part en pièce jointe, jamais en lien vers l'API, qu'ils ne pourraient pas ouvrir.

## Conséquences

- Supprimer une donnée supprime vraiment le fichier, ce qui sert l'effacement RGPD ([ADR-0011](ADR-0011-donnees-des-participants.md)).
- Chaque nouveau champ qui référence un fichier doit être ajouté à `deleteUnusedUploads` et à `collectUploadUrls`, sinon ses fichiers seront supprimés à tort ou jamais.
- Le nettoyage a lieu après la transaction : un échec à ce moment laisse un fichier orphelin, jamais une référence cassée.

## Options écartées

- **Nettoyage périodique des orphelins** : laisse des données personnelles sur le disque entre deux passages.
- **Stockage objet (S3)** : inutile pour le volume actuel, et le serveur n'a pas ce service.
