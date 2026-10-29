---
id: ADR-0039
titre: Comptes en libre-service : liens de compte hachés, adresse confirmée, stockage compté par propriétaire
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0034-jeton-d-invitation-hache.md, ADR-0038-un-seul-role-global.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0039 : Comptes en libre-service : liens de compte hachés, adresse confirmée, stockage compté par propriétaire

## Contexte

Le lot 2 de [SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) ouvre l'inscription : confirmation de l'adresse, mot de passe oublié, changement d'email, lien pour choisir son mot de passe, plafond de stockage. Il faut des liens à usage unique, un état « adresse confirmée » qui bloque tout le reste, et une taille par fichier.

## Décision

- **Liens de compte** : une table `AccountToken` (compte, type `confirm` | `email` | `password`, empreinte SHA-256 du jeton, nouvelle adresse pour `email`, expiration, date d'usage). Seule l'empreinte est gardée, comme pour les invitations ([ADR-0034](ADR-0034-jeton-d-invitation-hache.md)). Un nouveau lien d'un type remplace les liens non utilisés de ce type. Durées : confirmation et changement d'email 48 heures, mot de passe oublié 1 heure, lien envoyé par l'administratrice 7 jours.
- **Adresse confirmée** : `User.emailConfirmedAt`, avec `now()` pour défaut. Les comptes existants, ceux créés par l'administratrice, par le script ou depuis une invitation (le lien prouve l'adresse) sont confirmés ; seule l'inscription libre écrit `null`. `requireAuthUser` refuse (403) un compte non confirmé, sauf pour `me`, la déconnexion et le renvoi du lien.
- **Compte désactivé** : `User.disabledAt`. La désactivation incrémente la version de session ; la connexion et le mot de passe oublié refusent un compte désactivé, et `requireAuthUser` le refuse (401).
- **Inscription ouverte** : variable d'environnement `SIGNUP_OPEN=1`, lue à l'exécution. Pas de réglage en base : ouvrir l'inscription suit la publication des CGU, c'est une décision de mise en production.
- **Robots** : la limite par IP existante (`assertRateLimit`) et un champ piège ; aucun service externe.
- **Purge** : les comptes non confirmés de plus de 7 jours sont supprimés à chaque inscription et à chaque connexion. Pas de tâche planifiée : Limbus n'en a pas, et ces comptes ne bloquent rien d'autre que leur adresse.
- **Stockage** : `UploadedFile.size` et `User.storageQuotaMb` (500 par défaut). L'espace utilisé d'un compte est la somme des fichiers des jeux qu'il possède. Une taille inconnue (fichier d'avant) est relevée sur le disque et enregistrée au premier calcul.
- **Conversion des rôles** : la migration passe `organizer` à `user` ; le build en service (lot 1) accepte les deux ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).

## Conséquences

- Toutes les migrations du lot ajoutent des colonnes nullables ou avec défaut : compatibles avec le build en service.
- Les tests d'intégration qui créent des comptes en base les ont confirmés sans rien changer.
- Le plafond se vérifie avant d'écrire le fichier ; deux téléversements simultanés peuvent le dépasser d'un fichier, ce qui est accepté.

## Options écartées

- **Un drapeau booléen « confirmé »** : la date sert aussi à la purge et au support.
- **Une tâche planifiée pour la purge** : un mécanisme de plus à surveiller, pour un gain nul.
- **Compter le stockage par personne qui téléverse** : un jeu transféré garderait ses fichiers sur le compte de quelqu'un d'autre.
- **Un CAPTCHA** : service externe et données personnelles envoyées à un tiers.
