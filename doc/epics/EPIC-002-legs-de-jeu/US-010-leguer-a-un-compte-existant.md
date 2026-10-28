---
id: US-010
titre: Léguer une copie à une organisatrice qui a un compte
statut: à faire
epic: EPIC-002
regles: [R1, R2, R3, R4, R5, R6, R7, R9, R10, R11, R12, R13, R14]
adr: [ADR-0025]
---

# US-010 : Léguer une copie à une organisatrice qui a un compte

En tant que propriétaire d'un jeu, je veux en donner une copie à une organisatrice d'une autre équipe, afin qu'elle puisse le faire jouer de son côté sans toucher à ma version.

## Critères d'acceptation

- [ ] Sur la fiche de mon jeu, un bouton « Léguer une copie » est visible pour la propriétaire seulement (R1). Il ouvre une fenêtre qui :
  - demande l'email de la destinataire ;
  - rappelle ce qui est copié et ce qui ne l'est pas (R4, R5) ;
  - demande une confirmation.
- [ ] Mon propre email est refusé, avec une explication (R2).
- [ ] Si l'email correspond à un compte organisateur, la copie est créée et lui appartient aussitôt, sans acceptation (R7). Elle reçoit un email avec un lien vers la copie.
- [ ] Si l'email ne correspond à aucun compte, US-011 prend le relais ; avant US-011, le legs est refusé avec un message clair.
- [ ] La copie reprend :
  - la fiche du jeu ;
  - les personnages, factions, intrigues, objets, événements de la chronologie, documents et lieux ;
  - les réglages du trombinoscope ;
  - le formulaire d'inscription en vigueur, qui devient sa version 1 ;
  - tous les liens entre ces éléments, vers les éléments de la copie (R4, R14).
- [ ] Les sessions, participants, co-organisateurs, invitations, périodes d'inscription et inscriptions ne sont pas copiés (R5).
- [ ] Les photos de trombinoscope téléversées sont dupliquées sous un nouveau nom et rattachées à la copie. Les liens externes sont gardés tels quels (R6).
- [ ] La copie démarre active, sans page publique (R10).
- [ ] Sa fiche affiche « D'après « Titre du jeu source », de Nom de la propriétaire ». Ce crédit ne se modifie pas et reste si le jeu source est renommé ou supprimé (R11, R12). Une copie de copie montre son propre crédit (R13).
- [ ] Je peux léguer le même jeu plusieurs fois (R3). Modifier mon jeu ensuite ne change aucune copie (R9).

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
