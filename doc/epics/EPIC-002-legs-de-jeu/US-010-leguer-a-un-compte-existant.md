---
id: US-010
titre: Léguer une copie à une organisatrice qui a un compte
statut: terminée
epic: EPIC-002
regles: [R1, R2, R3, R4, R5, R6, R7, R9, R10, R11, R12, R13, R14]
adr: [ADR-0025]
---

# US-010 : Léguer une copie à une organisatrice qui a un compte

En tant que propriétaire d'un jeu, je veux en donner une copie à une organisatrice d'une autre équipe, afin qu'elle puisse le faire jouer de son côté sans toucher à ma version.

## Critères d'acceptation

- [x] Sur la fiche de mon jeu, un bouton « Léguer une copie » est visible pour la propriétaire seulement (R1). Il ouvre une fenêtre qui :
  - demande l'email de la destinataire ;
  - rappelle ce qui est copié et ce qui ne l'est pas (R4, R5) ;
  - demande une confirmation.
- [x] Mon propre email est refusé, avec une explication (R2).
- [x] Si l'email correspond à un compte organisateur, la copie est créée et lui appartient aussitôt, sans acceptation (R7). Elle reçoit un email avec un lien vers la copie.
- [x] Si l'email ne correspond à aucun compte, US-011 prend le relais ; avant US-011, le legs est refusé avec un message clair.
- [x] La copie reprend :
  - la fiche du jeu ;
  - les personnages, factions, intrigues, objets, événements de la chronologie, documents et lieux ;
  - les réglages du trombinoscope ;
  - le formulaire d'inscription en vigueur, qui devient sa version 1 ;
  - tous les liens entre ces éléments, vers les éléments de la copie (R4, R14).
- [x] Les sessions, participants, co-organisateurs, invitations, périodes d'inscription et inscriptions ne sont pas copiés (R5).
- [x] Les photos de trombinoscope téléversées sont dupliquées sous un nouveau nom et rattachées à la copie. Les liens externes sont gardés tels quels (R6).
- [x] La copie démarre active, sans page publique (R10).
- [x] Sa fiche affiche « D'après « Titre du jeu source », de Nom de la propriétaire ». Ce crédit ne se modifie pas et reste si le jeu source est renommé ou supprimé (R11, R12). Une copie de copie montre son propre crédit (R13).
- [x] Je peux léguer le même jeu plusieurs fois (R3). Modifier mon jeu ensuite ne change aucune copie (R9).

## Réalisation

- Bouton « Léguer une copie » sur la fiche du jeu, visible de la seule propriétaire, même en mode administrateur : le crédit porte son nom. La fenêtre rappelle ce qui est copié ou non, montre le crédit à venir et demande une case de confirmation.
- Route `POST /api/games/:id/bequests` : propriété vérifiée strictement, email normalisé, limite de 10 legs par heure et par jeu. Elle ne renvoie ni l'identifiant ni le slug de la copie, auxquels la propriétaire n'a pas accès.
- `copyGame` (`server/utils/gameCopy.ts`) suit `GAME_COPY_FIELDS` : pour chaque modèle, champs copiés, remplacés, reliés ou laissés. Le test unitaire compare cette liste au schéma Prisma, relations comprises.
- Les slugs de la copie sont réservés en mémoire avant la transaction (`generateUniqueSlug` accepte un ensemble de slugs pris), pour que deux éléments du même nom ne se disputent pas le même slug.
- Une photo téléversée absente du disque n'est pas reprise : la copie garde le personnage sans photo.
- Le formulaire d'inscription ne contient aujourd'hui que des réglages de champs standards, sans référence à un élément du jeu : sa définition est copiée telle quelle.
- Le crédit s'affiche sous le titre, sur la fiche du jeu (`gameCreditText`, `utils/games.ts`). La page publique ne l'affiche pas.

## Notes techniques

- Modèle ([ADR-0025](../../adr/ADR-0025-legs-de-jeu.md)) : `Game.creditSourceTitle`, `Game.creditAuthorName`, `Game.copiedFromGameId` (SetNull), `Game.bequestPending` (faux pour cette US). Migration additive.
- Service `copyGame` dans `server/utils/gameCopy.ts` : une transaction, table de correspondance des identifiants, slugs régénérés, liste explicite des champs copiés par modèle.
- Fichiers dupliqués avant la transaction, effacés si elle échoue.
- Route `POST /api/games/:id/bequests` avec `requireGameOwner`, schéma zod (email), limite de débit.

## Tests

- Unitaires : liste des champs copiés à jour avec le schéma Prisma (un champ ajouté à un modèle de contenu fait échouer le test tant qu'il n'est pas classé copié ou non copié) ; texte du crédit.
- Intégration :
  - copie complète et indépendante (aucun identifiant ni fichier partagé) ;
  - liens recréés ;
  - formulaire en version 1 ;
  - rien de R5 copié ;
  - la suppression du jeu source laisse la copie et son crédit intacts ;
  - un co-organisateur ne peut pas léguer ;
  - route ajoutée à `isolation.test.ts`.
- Bout en bout : legs depuis la fiche, puis copie visible chez la destinataire avec son crédit.
