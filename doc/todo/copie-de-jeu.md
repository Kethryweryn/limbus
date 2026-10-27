---
titre: Copie d'un jeu pour le léguer
statut: brouillon
date: 2026-10-27
---

# Copie d'un jeu pour le léguer

## Besoin

Une organisatrice veut confier son jeu à une autre équipe d'organisation. Elle garde sa propre version, et l'autre équipe obtient une copie qu'elle peut modifier librement pour organiser ses propres sessions.

## Proposition

- Dupliquer le contenu du jeu : personnages, factions, intrigues, objets, chronologie, documents, lieux, réglages du trombinoscope, et à terme le formulaire d'inscription.
- Les fichiers téléversés (photos de trombinoscope, documents) sont copiés sous de nouveaux UUID, pour que la suppression d'un côté n'affecte pas l'autre.
- Les liens entre entités sont recréés vers les copies, jamais vers les originaux.
- Les sessions, les participants, les paiements et les envois ne sont pas copiés : ce sont des données personnelles propres à chaque équipe.
- La copie est donnée à un autre compte organisateur, par exemple via le mécanisme d'invitation existant (`GameInvitation`). Le destinataire en devient propriétaire.

## Découpage envisagé

À préciser.

## Points à trancher

- Le destinataire doit-il accepter le transfert, ou la copie lui est-elle attribuée directement ?
- Garder une trace de l'origine de la copie (jeu source, auteurs) : crédit visible, ou simple information interne ?
- Faut-il pouvoir copier un jeu pour soi-même, par exemple pour préparer une deuxième version ?
