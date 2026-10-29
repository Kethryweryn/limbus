---
id: EPIC-013
titre: Inscription libre et compte en libre-service
statut: en cours
spec: ../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-013 : Inscription libre et compte en libre-service

## Objectif

Lot 2 de [SPEC-011](../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) : chacun crée son compte, confirme son adresse et le gère seul ; l'administratrice ne fixe plus de mot de passe ; chaque compte a un plafond de stockage. Corrige aussi l'écart 1 de [SPEC-008](../../specs/SPEC-008-comptes-et-partage.md) (invitation acceptée par un autre compte) et prévient la destinataire d'un transfert de jeu (lot 1).

## Décisions

- L'inscription libre s'ouvre par la variable d'environnement `SIGNUP_OPEN=1` ; fermée, l'écran de connexion n'affiche pas de lien « Créer un compte ».
- Un compte jamais confirmé est supprimé au bout de 7 jours.
- Un changement d'email prévient l'ancienne adresse.
- Le stockage d'un jeu compte pour sa propriétaire, même quand une co-organisatrice téléverse.
- La destinataire d'un transfert reçoit un email, et le jeu porte « Transfert proposé » dans sa liste.
- La règle « seule la bonne adresse accepte » vaut aussi pour un legs : il part, lui aussi, à une adresse.

## US

| US | Titre | Statut |
|---|---|---|
| [US-061](US-061-creer-son-compte.md) | Créer son compte et confirmer son adresse | à faire |
| [US-062](US-062-mot-de-passe-oublie.md) | Réinitialiser un mot de passe oublié | à faire |
| [US-063](US-063-gerer-son-compte.md) | Gérer son compte : nom, email, mot de passe | à faire |
| [US-064](US-064-invitation-par-la-bonne-adresse.md) | Une invitation n'est acceptée que par l'adresse invitée | à faire |
| [US-065](US-065-comptes-geres-par-l-administratrice.md) | L'administratrice crée, désactive et supprime les comptes | à faire |
| [US-066](US-066-plafond-de-stockage.md) | Plafond de stockage par compte | à faire |
| [US-067](US-067-conversion-des-comptes-organisateur.md) | Conversion des anciens comptes « organisateur » | à faire |
| [US-068](US-068-prevenir-la-destinataire-d-un-transfert.md) | Prévenir la destinataire d'un transfert de jeu | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0039](../../adr/ADR-0039-comptes-en-libre-service.md).
- CLAUDE.md : routes publiques du compte, adresse confirmée exigée par `requireUser`.
