---
id: ADR-0034
titre: Le jeton d'une invitation est gardé haché, comme les liens personnels
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-008-comptes-et-partage.md, ADR-0018-jetons-des-liens-personnels.md, ../archive/epics/EPIC-008-ecarts-comptes/US-042-jeton-d-invitation-hache.md]
---

# ADR-0034 : Le jeton d'une invitation est gardé haché

## Contexte

Les liens personnels des inscriptions et de la présence ne gardent que l'empreinte SHA-256 de leur jeton ([ADR-0018](ADR-0018-jetons-des-liens-personnels.md)). Les invitations à co-organiser et les legs (`GameInvitation`) gardent leur jeton en clair : une copie de la base suffirait à accepter les invitations en attente ([SPEC-008](../specs/SPEC-008-comptes-et-partage.md), écart 5).

## Décision

- Une invitation garde `tokenHash`, l'empreinte SHA-256 en hexadécimal de son jeton (32 octets aléatoires en base64url), calculée comme pour les liens personnels. Le jeton n'est plus écrit en base ; la colonne `token` devient facultative et reste vide.
- Une invitation se retrouve par l'empreinte du jeton du lien.
- Le jeton n'étant plus connu, renvoyer un legs crée un nouveau jeton. L'empreinte n'est remplacée qu'une fois l'email parti : sans email, l'ancien lien reste valable.
- La migration calcule l'empreinte des jetons existants dans PostgreSQL (`sha256`), puis les efface : les liens déjà envoyés restent valables.

## Conséquences

- Pendant le déploiement, l'ancien build cherche encore les invitations par leur jeton : une invitation ouverte dans ces quelques secondes est « introuvable », et le lien remarche avec le nouveau build. La migration le signale (ADR-0024).
- Une invitation à co-organiser ne se renvoie pas : on en crée une nouvelle, qui révoque l'ancienne, comme aujourd'hui.

## Options écartées

- **Chiffrer le jeton** : une clé à protéger en plus, pour un jeton qu'on n'a pas besoin de relire.
