---
id: ADR-0005
titre: Sauvegardes quotidiennes chiffrées, clé privée hors du serveur
statut: accepté
date: 2026-10-27
liens: []
---

# ADR-0005 : Sauvegardes quotidiennes chiffrées, clé privée hors du serveur

*Rédigé a posteriori, pour une décision prise et mise en place le 2026-10-27.*

## Contexte

L'ancienne sauvegarde envoyait sur Dedibackup des archives de `/var/www` non chiffrées, sans la base PostgreSQL. Dedibackup n'accepte que le FTP en clair : tout ce qui y part transite et reste lisible tel quel.

## Décision

- Le script `/usr/local/sbin/sauvegarde-serveur.sh` tourne par cron chaque jour à 03:15 (journal `/var/log/sauvegarde.log`).
- L'archive contient `/var/www`, les configurations utiles de `/etc`, et les dumps des bases (PostgreSQL `limbus` avec ses rôles, MariaDB des autres sites).
- Elle est chiffrée avec `age` vers une clé publique (`/etc/sauvegarde`) avant l'envoi ; 30 archives sont conservées.
- La clé privée n'est pas sur le serveur : elle est dans le gestionnaire de mots de passe du propriétaire. La procédure de restauration est dans `/etc/sauvegarde/RESTAURATION.txt` ; elle a été testée.

## Conséquences

- Une fuite de l'espace de sauvegarde ou une écoute du FTP n'expose rien de lisible.
- Une compromission du serveur ne permet pas de lire les sauvegardes passées.
- Perdre la clé privée rend toutes les sauvegardes inutilisables : elle doit rester dans le gestionnaire de mots de passe.
- Les anciennes archives non chiffrées restent à supprimer de Dedibackup (vérification planifiée le 2026-11-03).

## Options écartées

- **Chiffrement symétrique (gpg avec mot de passe)** : le secret devrait être sur le serveur pour chiffrer, donc lisible en cas de compromission.
- **Autre stockage (S3, SFTP)** : Dedibackup est inclus avec le serveur ; le chiffrement de bout en bout compense l'absence de transport chiffré.
