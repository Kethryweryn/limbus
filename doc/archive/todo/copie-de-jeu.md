---
titre: Copie d'un jeu pour le léguer
statut: prête
spec: ../../specs/SPEC-002-copie-de-jeu.md
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
- La copie est donnée à un autre compte organisateur, désigné par son email, qui en devient propriétaire.
- La copie est attribuée directement, sans acceptation du destinataire.
- Si l'email n'a pas encore de compte organisateur, on lui envoie l'invitation à créer un compte (mécanisme `GameInvitation` existant). La copie lui est attribuée dès qu'il l'accepte.
- La copie porte un crédit visible sur la fiche du jeu, par exemple « D'après « Titre du jeu source » de Nom de l'autrice ». Le crédit reste même si le jeu source est supprimé ensuite.
- On ne copie pas un jeu pour soi-même : la copie sert uniquement à léguer un jeu à une autre équipe.

## Découpage envisagé

1. Copie du contenu d'écriture vers un compte organisateur existant, avec les liens recréés et le crédit visible.
2. Copie des fichiers téléversés sous de nouveaux UUID.
3. Destinataire sans compte : invitation, puis attribution de la copie à l'acceptation.
4. Copie du formulaire d'inscription, une fois SPEC-001 assez avancée.

## Décisions

Décidé le 2026-10-28 :

- La copie est attribuée automatiquement.
- Un destinataire sans compte reçoit une invitation, et la copie lui est attribuée à l'acceptation.
- L'origine est conservée comme crédit visible.
- La copie pour soi-même n'est pas prévue.
