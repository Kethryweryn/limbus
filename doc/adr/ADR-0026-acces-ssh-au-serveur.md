---
id: ADR-0026
titre: Accès SSH au serveur par clé uniquement, clé root sans phrase de passe acceptée
statut: accepté
date: 2026-10-29
liens: [ADR-0003, ADR-0023]
---

# ADR-0026 : Accès SSH au serveur par clé uniquement, clé root sans phrase de passe acceptée

## Contexte

Le serveur de production (Debian 12, partagé avec d'autres sites) est exposé sur Internet en SSH. La [revue d'architecture du 29 octobre 2026](../revues/2026-10-29-architecture.md) (R-04) a constaté que l'authentification par mot de passe était active pour les comptes autres que root, avec fail2ban comme seule protection. L'ANSSI recommande l'authentification par clé pour l'administration à distance.

Trois accès existent :

- `root` par la clé `claude-limbus-server`, sur le PC de l'utilisatrice, sans phrase de passe. Claude l'utilise pour administrer le serveur (`ssh limbus`).
- `root` par la clé de déploiement GitHub, restreinte à `deploy.sh` par une commande forcée (ADR-0023).
- `xargos`, compte humain avec `sudo`, qui n'avait pas de clé jusqu'ici.

## Décision

- **Clé uniquement** : `PasswordAuthentication no` et `KbdInteractiveAuthentication no`, dans `/etc/ssh/sshd_config.d/50-cles-uniquement.conf`. `PermitRootLogin` reste à `without-password`.
- **`xargos`** a une clé dédiée (`id_ed25519_xargos` sur le PC de l'utilisatrice), protégée par une phrase de passe. La clé et sa phrase de passe sont conservées dans Proton Pass. PuTTY l'utilise après conversion en `.ppk`.
- **La clé root `claude-limbus-server` reste sans phrase de passe.** C'est un risque accepté par l'utilisatrice : un accès à son PC donne un accès root au serveur. Il est à réexaminer à la prochaine revue.

## Conséquences

- On ne devine plus de mot de passe en SSH. Les tentatives sont refusées avant toute authentification.
- Perdre la clé de `xargos` et sa sauvegarde ne coupe pas l'accès : root reste joignable par sa clé, et `su - xargos` permet d'en ajouter une nouvelle.
- Tout nouveau compte devra recevoir une clé avant de pouvoir se connecter.
- Le risque principal reste le PC de l'utilisatrice, qui porte une clé root utilisable sans phrase de passe.

## Options écartées

- **Garder les mots de passe avec fail2ban** : fail2ban ne fait que ralentir les essais, et la recommandation de l'ANSSI est explicite.
- **N'autoriser root qu'au déploiement** (`PermitRootLogin forced-commands-only`), et administrer via `xargos` et `sudo` : c'est la solution la plus sûre. Elle est écartée par l'utilisatrice pour l'instant, car Claude ne pourrait plus intervenir seul sur le serveur.
- **Phrase de passe sur la clé root, déverrouillée dans l'agent SSH de Windows** : proposée, écartée pour l'instant par l'utilisatrice.
- **Réutiliser pour `xargos` une clé existante du PC** : la première tentative a utilisé `id_ed25519`, une clé dont personne ne connaissait la phrase de passe. Elle a été retirée, au profit d'une clé créée pour l'occasion.
