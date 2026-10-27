---
id: ADR-0003
titre: Service systemd durci derrière Apache
statut: accepté
date: 2026-10-27
liens: [ADR-0002, ADR-0004]
---

# ADR-0003 : Service systemd durci derrière Apache

*Rédigé a posteriori, pour une décision prise et mise en place le 2026-10-27.*

## Contexte

Le serveur (Debian 12) est partagé avec d'autres sites : Apache sert aussi WordPress et d'autres domaines, et d'autres services tournent à côté. L'application tournait en root ; une faille dans Limbus aurait donné la main sur tout le serveur.

## Décision

- Le service `limbus` (installé par `install-service.sh`) tourne sous un utilisateur système dédié `limbus`, sans shell ni répertoire personnel, et n'écoute que sur `127.0.0.1:3000`.
- Le code appartient à root ; seul `.data` (fichiers téléversés) est inscriptible par le service. `.env` reste `root:600` : systemd le lit avant de changer d'utilisateur.
- Durcissement systemd : `ProtectSystem=strict` avec `ReadWritePaths` limité à `.data`, `NoNewPrivileges`, aucune capacité, `PrivateTmp`, `PrivateDevices`, `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`, et les autres protections du noyau.
- Apache fait le reverse proxy (vhost `limbuslarp.fr`), avec les en-têtes de sécurité dans un include propre à Limbus. Rien n'est modifié dans la configuration globale d'Apache, pour ne pas toucher aux autres sites.
- L'IP client, pour la limitation de débit, est la **dernière** entrée de `X-Forwarded-For`, et seulement si la connexion vient du proxy local (`clientIp`) : c'est celle qu'ajoute Apache, les précédentes sont fournies par le client.
- Node vient du paquet système (NodeSource, Node 24), pas de nvm.

## Conséquences

- Une compromission de l'application reste confinée à l'utilisateur `limbus` et à `.data`.
- Toute nouvelle écriture sur le disque doit aller sous `.data`, sinon elle échoue en production.
- Une nouvelle famille de sockets (par exemple un socket Unix vers un autre service) demande d'adapter `RestrictAddressFamilies`.
- Un HSTS ou une CSP globale à Apache est exclu : ils s'appliqueraient aux autres sites.

## Options écartées

- **Conteneur Docker** : pas de Docker sur ce serveur partagé ; systemd offre l'isolation nécessaire.
- **Rester en root** : rejeté pour la raison du contexte.
