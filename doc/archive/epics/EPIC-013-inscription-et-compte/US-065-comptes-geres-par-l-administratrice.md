---
id: US-065
titre: L'administratrice crée, désactive et supprime les comptes
statut: terminée
epic: EPIC-013
regles: [R9]
adr: [ADR-0039]
---

# US-065 : L'administratrice crée, désactive et supprime les comptes

En tant qu'administratrice, je veux créer un compte sans choisir de mot de passe à la place de la personne, et pouvoir suspendre un compte.

## Critères d'acceptation

- [x] La création demande nom, email et rôle ; la personne reçoit un lien pour choisir son mot de passe, valable 7 jours. Plus de champ mot de passe sur la page des comptes.
- [x] « Envoyer un lien de mot de passe » renvoie ce lien à un compte existant.
- [x] « Désactiver » déconnecte le compte et lui refuse la connexion ; « Réactiver » le rétablit. Ses jeux restent accessibles à leurs co-organisatrices. On ne se désactive pas soi-même, ni la dernière administratrice active.
- [x] La suppression reste refusée tant que le compte possède des jeux.
- [x] L'envoi d'emails désactivé, la création est refusée avec un message clair.

## Notes techniques

- `User.disabledAt`. `PUT /api/admin/users/:id` perd `password` et gagne `disabled` et `storageQuotaMb` ; `POST /api/admin/users/:id/password-link`.
- Le script `npm run user:create` garde la saisie d'un mot de passe : c'est l'amorçage du serveur.

## Tests

- Intégration : création (lien reçu, mot de passe choisi, connexion), désactivation (sessions refusées, connexion refusée, pas de lien de mot de passe), réactivation, renvoi du lien, isolation de la nouvelle route.
