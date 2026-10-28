---
id: SPEC-002
titre: Copie d'un jeu pour le léguer à une autre équipe
statut: validée
date: 2026-10-28
origine: ../archive/todo/copie-de-jeu.md
epics: []
adr: [ADR-0007, ADR-0008, ADR-0020]
---

# SPEC-002 : Copie d'un jeu pour le léguer à une autre équipe

## Objectif

Permettre à une organisatrice de confier son jeu à une autre équipe d'organisation. Elle garde sa version intacte. L'autre équipe reçoit une copie indépendante du contenu d'écriture, qu'elle modifie librement pour organiser ses propres sessions.

## Vocabulaire

- **Jeu source** : le jeu copié, qui reste à son autrice.
- **Copie** : le nouveau jeu créé à partir du jeu source. Il n'a plus aucun lien avec lui, sauf le crédit.
- **Destinataire** : la personne, désignée par son email, qui devient propriétaire de la copie.
- **Crédit** : la mention de l'origine, affichée sur la copie.

## Acteurs

- **Propriétaire du jeu source** : la seule à pouvoir le léguer (R1).
- **Destinataire** : une organisatrice, avec ou sans compte Limbus.

## Parcours

### Propriétaire : léguer un jeu

1. Depuis la fiche de son jeu, elle choisit « Léguer une copie » et saisit l'email de la destinataire.
2. Limbus lui rappelle ce qui est copié et ce qui ne l'est pas (R4, R5), puis elle confirme.
3. La copie est créée aussitôt. Le jeu source n'est pas modifié.

### Destinataire qui a déjà un compte

1. La copie apparaît directement dans ses jeux, dont elle est propriétaire. Elle n'a rien à accepter (R7).
2. Elle reçoit un email qui la prévient, avec un lien vers la copie.

### Destinataire sans compte

1. Elle reçoit un email d'invitation à créer son compte organisateur.
2. À la création du compte, la copie lui est attribuée, sans autre étape (R8).

## Règles métier

### Qui lègue, à qui

- **R1** Seule la propriétaire d'un jeu peut le léguer. Les co-organisateurs ne le peuvent pas.
- **R2** La destinataire est désignée par son email. Ce ne peut pas être la propriétaire elle-même : on ne copie pas un jeu pour soi.
- **R3** Un jeu peut être légué plusieurs fois, à des destinataires différentes ou à la même. Chaque legs crée une copie distincte.

### Ce qui est copié

- **R4** La copie reprend le contenu d'écriture du jeu :
  - la fiche du jeu : titre, description, note d'intention, lien du teaser ;
  - les personnages, factions, intrigues, objets, événements de la chronologie, documents et lieux, avec tous leurs champs ;
  - les réglages du trombinoscope de chaque personnage (qui connaît qui, nom affiché, visage connu ou non, note) ;
  - le formulaire d'inscription, car ses questions liées au casting sont souvent pensées avec les personnages écrits (R14) ;
  - tous les liens entre ces éléments : personnages des factions et des intrigues, objets portés ou situés, documents ciblés, événements liés. Ils pointent vers les éléments de la copie, jamais vers ceux du jeu source.
- **R5** Ne sont pas copiés, car ce sont des données propres à chaque équipe, souvent personnelles :
  - les sessions et tout ce qui en dépend : cast, attributions et photos des joueurs, paiements, envois, trombinoscopes générés, responsables de la chronologie ;
  - les participants et leurs liens au jeu ;
  - les co-organisateurs et les invitations en cours ;
  - les périodes d'inscription et les inscriptions, avec leurs réponses.
- **R6** Les fichiers téléversés dans Limbus (fond de personnage ou de faction, document, photo de trombinoscope d'un personnage) sont dupliqués sous un nouveau nom. Supprimer un fichier d'un côté ne touche pas l'autre. Les liens externes (http/https) sont repris tels quels.

- **R14** Le formulaire d'inscription est copié dans sa version en vigueur, qui devient la version 1 du formulaire de la copie. Les versions précédentes ne sont pas copiées : elles ne servent qu'aux réponses des inscriptions du jeu source. Une question qui fait référence à un élément du jeu (personnage, faction…) pointe vers l'élément correspondant de la copie, jamais vers celui du jeu source.

### Attribution

- **R7** La copie est attribuée directement à la destinataire qui a un compte organisateur : elle en devient propriétaire sans accepter quoi que ce soit.
- **R8** Si la destinataire n'a pas de compte, elle reçoit une invitation à en créer un (mécanisme des invitations existant). La copie lui est attribuée dès qu'elle crée son compte par cette invitation.
  - Tant que l'invitation n'est pas acceptée, la copie n'est visible par personne, y compris par la propriétaire du jeu source.
  - Si l'invitation expire (14 jours, comme les invitations existantes), la copie ne peut plus être attribuée. Sans tâche planifiée ([ADR-0020](../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)), elle est supprimée avec ses fichiers à la prochaine consultation ou action sur les legs en attente.
  - La propriétaire du jeu source voit l'invitation en attente et peut l'annuler, ce qui supprime aussi la copie.
- **R9** La copie est faite au moment du legs : les modifications ultérieures du jeu source ne la changent pas, même quand la destinataire n'a pas encore de compte.
- **R10** La copie démarre en jeu actif : non archivée, sans page publique.

### Crédit

- **R11** La copie porte un crédit visible sur sa fiche : « D'après « Titre du jeu source », de Nom de la propriétaire ».
- **R12** Le crédit est figé au moment du legs. Il reste si le jeu source est renommé ou supprimé, ou si le compte de son autrice l'est. La destinataire ne peut pas le modifier.
- **R13** Une copie de copie garde son propre crédit (celui du legs qui l'a créée) ; elle ne remonte pas la chaîne.

## Données

- La copie est un jeu comme un autre. Seul le crédit est nouveau : titre du jeu source et nom de son autrice au moment du legs.
- Le crédit contient le nom d'une organisatrice, donné avec son accord quand elle lègue. Il n'est pas couvert par l'export ou la suppression des données des participants, car il ne concerne pas un participant.
- La copie ne contient aucune donnée personnelle de participant (R5). Le contenu d'écriture peut citer des personnes réelles dans le texte libre : c'est sous la responsabilité de l'autrice, comme aujourd'hui.
- La façon de garder une copie en attente d'attribution (R8) fera l'objet d'un ADR.

## Sécurité et droits

- Léguer est réservé à la propriétaire du jeu source (R1) : la route vérifie la propriété, pas seulement l'accès au jeu.
- La copie appartient à la destinataire. La propriétaire du jeu source n'y a aucun accès, sauf si la destinataire l'invite ensuite comme co-organisatrice.
- Les fichiers dupliqués sont rattachés à la copie : ils sont servis avec les droits de la copie, et leur suppression suit ses règles (`deleteUnusedUploads`, [ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).
- Le legs est limité en débit, comme les autres envois d'emails.
- La nouvelle route et la copie doivent figurer dans `tests/integration/isolation.test.ts` : une organisatrice qui n'est pas propriétaire ne peut ni léguer ni voir une copie en attente.

## Découpage

1. Léguer une copie du contenu d'écriture et du formulaire d'inscription à un compte organisateur existant, avec les liens recréés et le crédit (R1 à R5, R7, R9 à R14).
2. Dupliquer les fichiers téléversés (R6).
3. Destinataire sans compte : invitation, copie en attente, attribution à la création du compte, expiration et annulation (R8).

## Hors périmètre

- Copier un jeu pour soi-même, par exemple pour en préparer une deuxième version.
- Synchroniser la copie avec le jeu source après le legs.
- Transférer la propriété du jeu source lui-même, sans copie.

## Historique

- 2026-10-28 : création à partir de la fiche todo. Choix de l'utilisatrice : attribution automatique, invitation puis attribution pour une destinataire sans compte, crédit visible, pas de copie pour soi-même.
- 2026-10-28 : le formulaire d'inscription est copié avec le contenu d'écriture, dès le premier lot (R4, R14).
