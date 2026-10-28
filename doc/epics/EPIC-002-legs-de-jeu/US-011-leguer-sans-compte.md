---
id: US-011
titre: Léguer une copie à une personne sans compte
statut: terminée
epic: EPIC-002
regles: [R7, R8, R9]
adr: [ADR-0025]
---

# US-011 : Léguer une copie à une personne sans compte

En tant que propriétaire d'un jeu, je veux pouvoir le léguer à une organisatrice qui n'utilise pas encore Limbus, afin qu'elle le retrouve dès la création de son compte.

## Critères d'acceptation

- [x] Quand l'email de la destinataire ne correspond à aucun compte, le legs crée la copie aussitôt, figée à ce moment (R9). La copie reste en attente : personne ne la voit, pas même moi (R8).
- [x] La destinataire reçoit un email d'invitation à créer son compte, qui précise qu'un jeu lui est légué et par qui.
- [x] Quand elle crée son compte par ce lien, la copie lui appartient aussitôt, sans autre étape. Elle n'est pas ajoutée comme co-organisatrice de quoi que ce soit.
- [x] Si elle a déjà créé un compte entre-temps par un autre chemin, elle peut se connecter puis accepter l'invitation : la copie lui est attribuée de la même façon.
- [x] Une invitation expirée (14 jours) ne donne plus la copie. La page de l'invitation le dit, et la copie en attente est supprimée.
- [x] Les invitations de co-organisation existantes fonctionnent comme avant.

## Réalisation

- L'invitation de legs est une `GameInvitation` de type `bequest`, rattachée à la copie en attente (pas au jeu source) ; elle n'apparaît pas dans la liste des partages, et la route d'annulation des invitations de co-organisation ne la touche pas (l'annulation d'un legs vient avec US-012).
- `accessibleGameWhere`, `requireGameAccess`, `requireGameOwner` et `gameScopedWhere` écartent les copies en attente, y compris en mode administrateur : le jeu, son contenu et ses fichiers.
- Si l'email d'invitation ne peut pas partir, la copie est supprimée et le legs refusé (502) : sans email, la destinataire n'aurait aucun moyen de la recevoir, et le renvoi n'arrive qu'avec US-012.
- La propriétaire du jeu source ne peut pas accepter son propre legs, même avec le lien (R2).
- Une invitation expirée est constatée à sa lecture (page d'invitation, création de compte, acceptation) : la copie est alors supprimée avec ses fichiers, et la page le dit. Le nettoyage depuis la liste des legs et à la création d'un nouveau legs vient avec US-012.
- La page `/invitations/:token` dit qui lègue quel jeu, et ses boutons parlent de « recevoir la copie ».

## Notes techniques

- `GameInvitation.kind` : `share` (par défaut, comportement actuel) ou `bequest`. Migration additive.
- La copie en attente : `ownerId` nul, `bequestPending` vrai. `accessibleGameWhere` l'écarte, y compris en mode administrateur ([ADR-0025](../../adr/ADR-0025-legs-de-jeu.md)).
- `acceptInvitationForUser` attribue la copie pour `bequest`, dans une transaction, au lieu de créer un `GameShare`.
- La page d'invitation (`/invitations/:token`) adapte son texte au legs.

## Tests

- Intégration :
  - copie en attente invisible pour la propriétaire du jeu source, pour une autre organisatrice et en mode administrateur ;
  - attribution à la création du compte, puis par acceptation après connexion ;
  - invitation expirée : refus, et copie supprimée avec ses fichiers ;
  - une invitation de co-organisation donne toujours un `GameShare`.
- Unitaires : texte de l'email d'invitation au legs.
